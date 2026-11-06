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
if ($method === 'POST') {
    if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) json_response(['ok' => false, 'error' => 'File upload tidak valid.'], 422);
    $file = $_FILES['file'];
    if ($file['size'] > 5 * 1024 * 1024) json_response(['ok' => false, 'error' => 'Ukuran maksimal 5 MB.'], 413);
    $mime = (new finfo(FILEINFO_MIME_TYPE))->file($file['tmp_name']);
    if (!isset($allowed[$mime])) json_response(['ok' => false, 'error' => 'Format hanya JPG, PNG, atau WebP.'], 415);
    $name = bin2hex(random_bytes(12)) . '.' . $allowed[$mime];
    if (!move_uploaded_file($file['tmp_name'], $mediaDir . '/' . $name)) json_response(['ok' => false, 'error' => 'File gagal disimpan.'], 500);
    json_response(['ok' => true, 'file' => $name, 'bytes' => (int) $file['size']], 201);
}
if ($method === 'DELETE') {
    $name = (string) ($_GET['file'] ?? '');
    if (!preg_match('/^[a-f0-9]{24}\.(jpg|png|webp)$/', $name)) json_response(['ok' => false, 'error' => 'Nama file tidak valid.'], 400);
    $path = $mediaDir . '/' . $name;
    if (!is_file($path)) json_response(['ok' => false, 'error' => 'Media tidak ditemukan.'], 404);
    unlink($path);
    json_response(['ok' => true]);
}
header('Allow: GET, POST, DELETE');
json_response(['ok' => false, 'error' => 'Method tidak didukung.'], 405);
