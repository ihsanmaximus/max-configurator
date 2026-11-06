<?php
declare(strict_types=1);
require_once __DIR__ . '/../bootstrap.php';
start_admin_session();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$passwordHash = (string) getenv('MAXIMUS_ADMIN_PASSWORD_HASH');
if ($passwordHash === '') {
    json_response(['ok' => false, 'error' => 'Autentikasi belum dikonfigurasi. Atur MAXIMUS_ADMIN_PASSWORD_HASH pada environment PHP.'], 503);
}

if ($method === 'GET') {
    $authenticated = !empty($_SESSION['maximus_admin']);
    json_response([
        'ok' => true,
        'authenticated' => $authenticated,
        'csrfToken' => $authenticated ? ($_SESSION['maximus_csrf'] ?? null) : null
    ]);
}

if ($method === 'POST') {
    $data = request_json();
    if (admin_login_throttle() > 0) {
        header('Retry-After: 900');
        json_response(['ok' => false, 'error' => 'Terlalu banyak percobaan login dari jaringan ini. Coba lagi 15 menit.'], 429);
    }
    $password = (string) ($data['password'] ?? '');
    if ($password === '' || strlen($password) > 200 || !password_verify($password, $passwordHash)) {
        $remaining = admin_login_throttle(true);
        if ($remaining > 0) {
            header('Retry-After: ' . $remaining);
            json_response(['ok' => false, 'error' => 'Batas percobaan login tercapai. Coba lagi 15 menit.'], 429);
        }
        json_response(['ok' => false, 'error' => 'Password admin tidak sesuai.'], 401);
    }
    admin_login_throttle(false, true);
    session_regenerate_id(true);
    $_SESSION['maximus_admin'] = true;
    $_SESSION['maximus_csrf'] = bin2hex(random_bytes(32));
    json_response(['ok' => true, 'authenticated' => true, 'csrfToken' => $_SESSION['maximus_csrf']]);
}

if ($method === 'DELETE') {
    require_admin();
    require_csrf();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
    }
    session_destroy();
    json_response(['ok' => true]);
}
header('Allow: GET, POST, DELETE');
json_response(['ok' => false, 'error' => 'Method tidak didukung.'], 405);
