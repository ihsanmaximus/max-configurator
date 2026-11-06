<?php
declare(strict_types=1);

/**
 * Maximus Configurator API bootstrap.
 * Requires PHP 8.1+ and persistent writable storage.
 */
const MAXIMUS_STORAGE_ROOT = __DIR__ . '/storage/projects';
const MAXIMUS_MAX_JSON_BYTES = 1048576; // 1 MiB

function json_response(array $payload, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function request_json(): array {
    $length = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length > MAXIMUS_MAX_JSON_BYTES) {
        json_response(['ok' => false, 'error' => 'Ukuran data melebihi batas 1 MB.'], 413);
    }
    $raw = file_get_contents('php://input', false, null, 0, MAXIMUS_MAX_JSON_BYTES + 1);
    if ($raw === false || trim($raw) === '') return [];
    if (strlen($raw) > MAXIMUS_MAX_JSON_BYTES) {
        json_response(['ok' => false, 'error' => 'Ukuran data melebihi batas 1 MB.'], 413);
    }
    $data = json_decode($raw, true, 32);
    if (!is_array($data) || json_last_error() !== JSON_ERROR_NONE) {
        json_response(['ok' => false, 'error' => 'JSON tidak valid atau struktur terlalu dalam.'], 400);
    }
    return $data;
}

function ensure_storage(): void {
    if (!is_dir(MAXIMUS_STORAGE_ROOT) && !mkdir(MAXIMUS_STORAGE_ROOT, 0750, true) && !is_dir(MAXIMUS_STORAGE_ROOT)) {
        json_response(['ok' => false, 'error' => 'Folder penyimpanan tidak dapat dibuat.'], 500);
    }
}

function valid_project_id(string $id): bool {
    return (bool) preg_match('/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,63}$/', $id);
}

function project_dir(string $id): string {
    if (!valid_project_id($id)) json_response(['ok' => false, 'error' => 'ID project tidak valid.'], 400);
    return MAXIMUS_STORAGE_ROOT . '/' . $id;
}

function read_project(string $id): ?array {
    $path = project_dir($id) . '/config.json';
    if (!is_file($path)) return null;
    $raw = file_get_contents($path);
    if ($raw === false || strlen($raw) > MAXIMUS_MAX_JSON_BYTES) return null;
    $data = json_decode($raw, true, 32);
    return is_array($data) && json_last_error() === JSON_ERROR_NONE ? $data : null;
}

/** Bound JSON complexity and media references before persisting a project. */
function validate_project_config(array $data, string $id): void {
    $nodes = 0;
    $walk = function ($value, int $depth = 0) use (&$walk, &$nodes): void {
        $nodes++;
        if ($nodes > 5000 || $depth > 16) {
            json_response(['ok' => false, 'error' => 'Struktur konfigurasi terlalu kompleks.'], 422);
        }
        if (is_string($value) && strlen($value) > 20000) {
            json_response(['ok' => false, 'error' => 'Ada teks konfigurasi yang melebihi 20 KB.'], 422);
        }
        if (is_array($value)) {
            if (count($value) > 500) json_response(['ok' => false, 'error' => 'Terlalu banyak item dalam konfigurasi.'], 422);
            foreach ($value as $child) $walk($child, $depth + 1);
        } elseif (!is_null($value) && !is_string($value) && !is_int($value) && !is_float($value) && !is_bool($value)) {
            json_response(['ok' => false, 'error' => 'Tipe data konfigurasi tidak didukung.'], 422);
        }
    };
    $walk($data);

    if (!isset($data['project']) || !is_array($data['project'])) {
        json_response(['ok' => false, 'error' => 'Struktur config project tidak valid.'], 422);
    }
    $name = trim((string) ($data['project']['name'] ?? ''));
    $nameLength = preg_match_all('/./us', $name);
    if ($name === '' || $nameLength === false || $nameLength > 100) {
        json_response(['ok' => false, 'error' => 'Nama project wajib diisi (maksimal 100 karakter).'], 422);
    }

    $media = $data['media'] ?? [];
    if (!is_array($media)) json_response(['ok' => false, 'error' => 'Referensi media tidak valid.'], 422);
    $mediaDir = project_dir($id) . '/media';
    foreach (['logo', 'hero', 'about', 'expertise'] as $slot) {
        $reference = $media[$slot] ?? null;
        if ($reference === null) continue;
        if (!is_array($reference) || !isset($reference['file']) ||
            !preg_match('/^[a-f0-9]{24}\.(jpg|png|webp)$/', (string) $reference['file']) ||
            !is_file($mediaDir . '/' . $reference['file'])) {
            json_response(['ok' => false, 'error' => 'Referensi media ' . $slot . ' tidak ditemukan pada project ini.'], 422);
        }
    }
}

function write_project(string $id, array $data): void {
    validate_project_config($data, $id);
    $dir = project_dir($id);
    if (!is_dir($dir) && !mkdir($dir, 0750, true) && !is_dir($dir)) {
        json_response(['ok' => false, 'error' => 'Folder project gagal dibuat.'], 500);
    }
    $data['project']['id'] = $id;
    $data['project']['updatedAt'] = gmdate('c');
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false || strlen($json) > MAXIMUS_MAX_JSON_BYTES) {
        json_response(['ok' => false, 'error' => 'Konfigurasi tidak dapat disimpan atau melebihi 1 MB.'], 413);
    }

    // Keep a bounded rolling backup before replacing an existing configuration.
    $target = $dir . '/config.json';
    if (is_file($target)) {
        $backupDir = $dir . '/backups';
        if (!is_dir($backupDir) && !mkdir($backupDir, 0750, true) && !is_dir($backupDir)) {
            json_response(['ok' => false, 'error' => 'Folder backup gagal dibuat; konfigurasi lama dipertahankan.'], 500);
        }
        $backupName = gmdate('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.json';
        if (!copy($target, $backupDir . '/' . $backupName)) {
            json_response(['ok' => false, 'error' => 'Backup konfigurasi gagal; penyimpanan dibatalkan.'], 500);
        }
        $backups = glob($backupDir . '/*.json') ?: [];
        usort($backups, static fn($a, $b) => filemtime($b) <=> filemtime($a));
        foreach (array_slice($backups, 10) as $oldBackup) @unlink($oldBackup);
    }
    $temporary = tempnam($dir, '.config-');
    if ($temporary === false) json_response(['ok' => false, 'error' => 'File sementara gagal dibuat.'], 500);
    $written = file_put_contents($temporary, $json, LOCK_EX);
    if ($written === false || !rename($temporary, $target)) {
        if (is_file($temporary)) unlink($temporary);
        json_response(['ok' => false, 'error' => 'Konfigurasi gagal disimpan.'], 500);
    }
}

/** Session-based admin authentication. Configure MAXIMUS_ADMIN_PASSWORD_HASH in the PHP environment. */
function start_admin_session(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    // Do not trust client-supplied X-Forwarded-Proto. Set this server-side only
    // when a trusted reverse proxy terminates TLS before PHP.
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || getenv('MAXIMUS_FORCE_SECURE_COOKIE') === '1';
    session_name('MAXIMUS_ADMIN');
    session_set_cookie_params([
        'lifetime' => 0, 'path' => '/',
        'secure' => $https, 'httponly' => true, 'samesite' => 'Strict'
    ]);
    session_start();
}

/**
 * Persistent per-IP login throttling. Returns remaining lock seconds.
 * State files live under protected storage and are updated under an exclusive lock.
 */
function admin_login_throttle(bool $failed = false, bool $reset = false): int {
    $root = dirname(MAXIMUS_STORAGE_ROOT) . '/auth-rate-limit';
    if (!is_dir($root) && !mkdir($root, 0700, true) && !is_dir($root)) {
        // Fail closed if global throttling cannot be persisted.
        return 900;
    }
    $ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    $key = hash('sha256', $ip);
    $handle = fopen($root . '/' . $key . '.json', 'c+');
    if ($handle === false) return 900;
    try {
        if (!flock($handle, LOCK_EX)) return 900;
        rewind($handle);
        $raw = stream_get_contents($handle);
        $state = is_string($raw) ? json_decode($raw, true) : null;
        if (!is_array($state)) $state = ['window' => time(), 'attempts' => 0, 'lockedUntil' => 0];
        $now = time();
        if ((int) ($state['lockedUntil'] ?? 0) > $now) return (int) $state['lockedUntil'] - $now;
        if ($reset) {
            $state = ['window' => $now, 'attempts' => 0, 'lockedUntil' => 0];
        } else {
            if ($now - (int) ($state['window'] ?? 0) >= 900) {
                $state = ['window' => $now, 'attempts' => 0, 'lockedUntil' => 0];
            }
            if ($failed) {
                $state['attempts'] = (int) $state['attempts'] + 1;
                if ($state['attempts'] >= 10) $state['lockedUntil'] = $now + 900;
            }
        }
        rewind($handle);
        ftruncate($handle, 0);
        fwrite($handle, json_encode($state));
        fflush($handle);
        return max(0, (int) ($state['lockedUntil'] ?? 0) - $now);
    } finally {
        flock($handle, LOCK_UN);
        fclose($handle);
    }
}

function require_admin(): void {
    start_admin_session();
    if (empty($_SESSION['maximus_admin'])) {
        json_response(['ok' => false, 'error' => 'Sesi admin tidak aktif. Silakan login kembali.'], 401);
    }
}

function require_csrf(): void {
    $provided = (string) ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    $known = (string) ($_SESSION['maximus_csrf'] ?? '');
    if ($known === '' || $provided === '' || !hash_equals($known, $provided)) {
        json_response(['ok' => false, 'error' => 'Token keamanan tidak valid. Muat ulang halaman dan coba lagi.'], 403);
    }
}
