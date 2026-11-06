<?php
declare(strict_types=1);

/**
 * Maximus Configurator API bootstrap.
 * Prototype storage adapter for conventional PHP hosting with persistent disk.
 */
const MAXIMUS_STORAGE_ROOT = __DIR__ . '/storage/projects';

function json_response(array $payload, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function request_json(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') return [];
    $data = json_decode($raw, true);
    if (!is_array($data)) json_response(['ok' => false, 'error' => 'JSON tidak valid.'], 400);
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
    $data = json_decode((string) file_get_contents($path), true);
    return is_array($data) ? $data : null;
}

function write_project(string $id, array $data): void {
    $dir = project_dir($id);
    if (!is_dir($dir) && !mkdir($dir, 0750, true) && !is_dir($dir)) {
        json_response(['ok' => false, 'error' => 'Folder project gagal dibuat.'], 500);
    }
    $data['project']['id'] = $id;
    $data['project']['updatedAt'] = gmdate('c');
    $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false || file_put_contents($dir . '/config.json', $json, LOCK_EX) === false) {
        json_response(['ok' => false, 'error' => 'Konfigurasi gagal disimpan.'], 500);
    }
}
