<?php
declare(strict_types=1);
require_once __DIR__ . '/../bootstrap.php';
require_admin();
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (in_array($method, ['POST', 'PUT', 'DELETE'], true)) require_csrf();
ensure_storage();

$id = isset($_GET['id']) ? (string) $_GET['id'] : '';

if ($method === 'GET' && $id === '') {
    $projects = [];
    foreach (glob(MAXIMUS_STORAGE_ROOT . '/*/config.json') ?: [] as $file) {
        $data = json_decode((string) file_get_contents($file), true);
        if (is_array($data)) {
            $projects[] = [
                'id' => basename(dirname($file)),
                'name' => $data['project']['name'] ?? basename(dirname($file)),
                'package' => $data['project']['package'] ?? 'paket-2',
                'updatedAt' => $data['project']['updatedAt'] ?? null
            ];
        }
    }
    json_response(['ok' => true, 'projects' => $projects]);
}

if ($method === 'POST') {
    $data = request_json();
    $name = trim((string) ($data['name'] ?? ''));
    $nameLength = preg_match_all('/./us', $name);
    if ($name === '' || $nameLength === false || $nameLength > 100) json_response(['ok' => false, 'error' => 'Nama project wajib diisi (maksimal 100 karakter).'], 422);
    $config = $data['config'] ?? [];
    if (!is_array($config)) json_response(['ok' => false, 'error' => 'Config harus berupa object JSON.'], 422);
    $id = 'prj_' . bin2hex(random_bytes(8));
    $config['project'] = array_merge(is_array($config['project'] ?? null) ? $config['project'] : [], ['id' => $id, 'name' => $name, 'package' => 'paket-2']);
    write_project($id, $config);
    json_response(['ok' => true, 'project' => ['id' => $id, 'name' => $name]], 201);
}

if ($id === '') json_response(['ok' => false, 'error' => 'Parameter id wajib diisi.'], 400);
$dir = project_dir($id);
$action = (string) ($_GET['action'] ?? '');

if ($action === 'backups' && $method === 'GET') {
    if (!is_dir($dir)) json_response(['ok' => false, 'error' => 'Project tidak ditemukan.'], 404);
    $backupDir = $dir . '/backups';
    $items = [];
    foreach (glob($backupDir . '/*.json') ?: [] as $file) {
        $items[] = ['file' => basename($file), 'createdAt' => gmdate('c', (int) filemtime($file)), 'bytes' => filesize($file)];
    }
    usort($items, static fn($a, $b) => strcmp($b['file'], $a['file']));
    json_response(['ok' => true, 'backups' => $items]);
}

if ($action === 'restore' && $method === 'POST') {
    if (!is_dir($dir)) json_response(['ok' => false, 'error' => 'Project tidak ditemukan.'], 404);
    $data = request_json();
    $backupName = (string) ($data['file'] ?? '');
    if (!preg_match('/^[0-9]{8}_[0-9]{6}_[a-f0-9]{8}\\.json$/', $backupName)) {
        json_response(['ok' => false, 'error' => 'Nama backup tidak valid.'], 400);
    }
    $backupPath = $dir . '/backups/' . $backupName;
    if (!is_file($backupPath)) json_response(['ok' => false, 'error' => 'Backup tidak ditemukan.'], 404);
    $rawBackup = file_get_contents($backupPath);
    $backupConfig = $rawBackup === false ? null : json_decode($rawBackup, true, 32);
    if (!is_array($backupConfig) || json_last_error() !== JSON_ERROR_NONE) {
        json_response(['ok' => false, 'error' => 'Isi backup rusak atau tidak valid.'], 422);
    }
    write_project($id, $backupConfig);
    json_response(['ok' => true, 'restored' => $backupName]);
}

if ($method === 'GET') {
    $config = read_project($id);
    if ($config === null) json_response(['ok' => false, 'error' => 'Project tidak ditemukan atau data rusak.'], 404);
    json_response(['ok' => true, 'config' => $config]);
}
if ($method === 'PUT') {
    if (!is_dir($dir)) json_response(['ok' => false, 'error' => 'Project tidak ditemukan.'], 404);
    $config = request_json();
    write_project($id, $config);
    json_response(['ok' => true, 'updatedAt' => gmdate('c')]);
}
if ($method === 'DELETE') {
    if (!is_dir($dir)) json_response(['ok' => false, 'error' => 'Project tidak ditemukan.'], 404);
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($iterator as $item) $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
    rmdir($dir);
    json_response(['ok' => true]);
}
header('Allow: GET, POST, PUT, DELETE');
json_response(['ok' => false, 'error' => 'Method tidak didukung.'], 405);
