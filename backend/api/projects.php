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
    $nameLength = preg_match_all('/./us', $name, $nameChars);
    if ($name === '' || $nameLength === false || $nameLength > 100) json_response(['ok' => false, 'error' => 'Nama project wajib diisi (maksimal 100 karakter).'], 422);
    $id = 'prj_' . bin2hex(random_bytes(8));
    $config = $data['config'] ?? [];
    if (!is_array($config)) json_response(['ok' => false, 'error' => 'Config harus berupa object JSON.'], 422);
    $config['project'] = array_merge(is_array($config['project'] ?? null) ? $config['project'] : [], ['id' => $id, 'name' => $name, 'package' => 'paket-2']);
    write_project($id, $config);
    json_response(['ok' => true, 'project' => ['id' => $id, 'name' => $name]], 201);
}

if ($id === '') json_response(['ok' => false, 'error' => 'Parameter id wajib diisi.'], 400);
$dir = project_dir($id);

if ($method === 'GET') {
    $config = read_project($id);
    if ($config === null) json_response(['ok' => false, 'error' => 'Project tidak ditemukan.'], 404);
    json_response(['ok' => true, 'config' => $config]);
}
if ($method === 'PUT') {
    if (!is_dir($dir)) json_response(['ok' => false, 'error' => 'Project tidak ditemukan.'], 404);
    $config = request_json();
    if (!isset($config['project']) || !is_array($config['project'])) {
        json_response(['ok' => false, 'error' => 'Struktur config project tidak valid.'], 422);
    }
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
