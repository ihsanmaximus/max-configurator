<?php
declare(strict_types=1);
require_once __DIR__ . '/../bootstrap.php';
require_admin();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (in_array($method, ['POST', 'DELETE'], true)) require_csrf();
ensure_storage();

$projectId = (string) ($_GET['project_id'] ?? '');
$dir = project_dir($projectId);
if (!is_dir($dir)) json_response(['ok' => false, 'error' => 'Project tidak ditemukan.'], 404);
$mediaDir = $dir . '/media';
if (!is_dir($mediaDir) && !mkdir($mediaDir, 0750, true) && !is_dir($mediaDir)) {
    json_response(['ok' => false, 'error' => 'Folder media gagal dibuat.'], 500);
}

$allowed = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
if ($method === 'GET' && (string) ($_GET['action'] ?? '') === 'backups') {
    $items = [];
    foreach (glob($dir . '/media-backups/*') ?: [] as $path) {
        if (is_file($path) && preg_match('/^[a-f0-9]{24}\\.(jpg|png|webp)$/', basename($path))) {
            $items[] = ['file' => basename($path), 'bytes' => filesize($path)];
        }
    }
    json_response(['ok' => true, 'backups' => $items]);
}

if ($method === 'GET') {
    $requested = (string) ($_GET['file'] ?? '');
    if ($requested !== '') {
        if (!preg_match('/^[a-f0-9]{24}\\.(jpg|png|webp)$/', $requested)) json_response(['ok' => false, 'error' => 'Nama file tidak valid.'], 400);
        $path = $mediaDir . '/' . $requested;
        if (!is_file($path)) json_response(['ok' => false, 'error' => 'Media tidak ditemukan.'], 404);
        $mime = (new finfo(FILEINFO_MIME_TYPE))->file($path) ?: 'application/octet-stream';
        header('Content-Type: ' . $mime);
        header('Content-Length: ' . filesize($path));
        header('X-Content-Type-Options: nosniff');
        readfile($path);
        exit;
    }
    $items = [];
    foreach (glob($mediaDir . '/*') ?: [] as $path) {
        if (is_file($path)) $items[] = ['file' => basename($path), 'bytes' => filesize($path), 'url' => 'media.php?project_id=' . rawurlencode($projectId) . '&file=' . rawurlencode(basename($path))];
    }
    json_response(['ok' => true, 'media' => $items]);
}
if ($method === 'POST' && (string) ($_GET['action'] ?? '') === 'restore') {
    $name = (string) ($_GET['file'] ?? '');
    if (!preg_match('/^[a-f0-9]{24}\\.(jpg|png|webp)$/', $name)) {
        json_response(['ok' => false, 'error' => 'Nama file backup tidak valid.'], 400);
    }
    $backupPath = $dir . '/media-backups/' . $name;
    if (!is_file($backupPath)) json_response(['ok' => false, 'error' => 'Backup media tidak ditemukan.'], 404);
    if (is_file($mediaDir . '/' . $name)) json_response(['ok' => false, 'error' => 'Media dengan nama tersebut sudah tersedia.'], 409);
    if (!copy($backupPath, $mediaDir . '/' . $name)) json_response(['ok' => false, 'error' => 'Pemulihan media gagal.'], 500);
    json_response(['ok' => true, 'file' => $name, 'restored' => true]);
}

if ($method === 'POST') {
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) json_response(['ok' => false, 'error' => 'File upload tidak valid.'], 422);
    $file = $_FILES['file'];
    if ($file['size'] > 5 * 1024 * 1024) json_response(['ok' => false, 'error' => 'Ukuran maksimal 5 MB.'], 413);
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    $imageInfo = @getimagesize($file['tmp_name']);
    if (!isset($allowed[$mime]) || $imageInfo === false || ($imageInfo['mime'] ?? '') !== $mime) {
        json_response(['ok' => false, 'error' => 'Isi file bukan gambar JPG, PNG, atau WebP yang valid.'], 415);
    }
    $width = (int) ($imageInfo[0] ?? 0);
    $height = (int) ($imageInfo[1] ?? 0);
    if ($width < 1 || $height < 1 || $width > 10000 || $height > 10000 || ($width * $height) > 40000000) {
        json_response(['ok' => false, 'error' => 'Dimensi gambar terlalu besar. Maksimal 10.000 px per sisi dan 40 megapiksel.'], 422);
    }
    $name = bin2hex(random_bytes(12)) . '.' . $allowed[$mime];
    if (!move_uploaded_file($file['tmp_name'], $mediaDir . '/' . $name)) json_response(['ok' => false, 'error' => 'File gagal disimpan.'], 500);
    json_response(['ok' => true, 'file' => $name, 'bytes' => (int) $file['size']], 201);
}
if ($method === 'DELETE') {
    $name = (string) ($_GET['file'] ?? '');
    if (!preg_match('/^[a-f0-9]{24}\.(jpg|png|webp)$/', $name)) json_response(['ok' => false, 'error' => 'Nama file tidak valid.'], 400);
    $path = $mediaDir . '/' . $name;
    if (!is_file($path)) json_response(['ok' => false, 'error' => 'Media tidak ditemukan.'], 404);

    // Preserve a copy of the media before unlinking it. This allows recovery
    // without leaving stale references in the active configuration.
    $mediaBackupDir = $dir . '/media-backups';
    if (!is_dir($mediaBackupDir) && !mkdir($mediaBackupDir, 0750, true) && !is_dir($mediaBackupDir)) {
        json_response(['ok' => false, 'error' => 'Folder backup media gagal dibuat; file tidak dihapus.'], 500);
    }
    if (!copy($path, $mediaBackupDir . '/' . $name)) {
        json_response(['ok' => false, 'error' => 'Backup media gagal; file tidak dihapus.'], 500);
    }
    // Keep at most 30 media backups per project.
    $mediaBackups = glob($mediaBackupDir . '/*') ?: [];
    usort($mediaBackups, static fn($a, $b) => filemtime($b) <=> filemtime($a));
    foreach (array_slice($mediaBackups, 30) as $oldBackup) @unlink($oldBackup);

    // Remove every configuration reference before deleting the file, so a later
    // project load cannot point at a missing asset.
    $config = read_project($projectId);
    if ($config !== null && is_array($config['media'] ?? null)) {
        $changed = false;
        foreach (['logo', 'hero', 'about', 'expertise'] as $slot) {
            if (($config['media'][$slot]['file'] ?? null) === $name) {
                $config['media'][$slot] = null;
                $changed = true;
            }
        }
        if ($changed) write_project($projectId, $config);
    }
    if (!unlink($path)) json_response(['ok' => false, 'error' => 'Media gagal dihapus. Referensi konfigurasi sudah dilepas.'], 500);
    json_response(['ok' => true]);
}
header('Allow: GET, POST, DELETE');
json_response(['ok' => false, 'error' => 'Method tidak didukung.'], 405);
