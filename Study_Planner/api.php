<?php
    // Suppress ALL PHP notices/warnings so they don't pollute JSON output
    error_reporting(0);
    ini_set('display_errors', 0);

    header("Content-Type: application/json");
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type");

    // Handle Preflight
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(200); exit(0); }

    $host    = 'sql300.infinityfree.com';
    $db      = 'if0_41695840_study_planner';
    $user    = 'if0_41695840';
    $pass    = 'RON28712871';
    $charset = 'utf8mb4';

    $dsn = "mysql:host=$host;dbname=$db;charset=$charset";
    try {
        $pdo = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(["error" => "Connection failed: " . $e->getMessage()]);
        exit;
    }

    $method = $_SERVER['REQUEST_METHOD'];

    // GET: Fetch tasks
    if ($method === 'GET') {
        try {
            $stmt = $pdo->query("SELECT * FROM tasks ORDER BY position_index ASC, deadline ASC");
            echo json_encode($stmt->fetchAll());
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        exit;
    }

    // POST: Create Task
    if ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data) {
            http_response_code(400);
            echo json_encode(["error" => "Invalid JSON"]);
            exit;
        }
        try {
            $sql  = "INSERT INTO tasks (subject, task_name, deadline, priority, status, position_index) VALUES (?, ?, ?, ?, 0, 0)";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $data['subject']   ?? '',
                $data['task_name'] ?? '',
                $data['deadline']  ?? null,
                $data['priority']  ?? 'Medium'
            ]);
            echo json_encode(["id" => $pdo->lastInsertId()]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        exit;
    }

    // PUT: Update Task (Status or Position)
    if ($method === 'PUT') {
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data) {
            http_response_code(400);
            echo json_encode(["error" => "Invalid JSON"]);
            exit;
        }
        try {
            if (isset($data['status'])) {
                $sql  = "UPDATE tasks SET status = ? WHERE id = ?";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$data['status'], $data['id']]);
            } elseif (isset($data['reorder'])) {
                $pdo->beginTransaction();
                foreach ($data['reorder'] as $index => $taskId) {
                    $stmt = $pdo->prepare("UPDATE tasks SET position_index = ? WHERE id = ?");
                    $stmt->execute([$index, $taskId]);
                }
                $pdo->commit();
            }
            echo json_encode(["success" => true]);
        } catch (PDOException $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        exit;
    }

    // DELETE: Remove Task
    if ($method === 'DELETE') {
        $id = intval($_GET['id'] ?? 0);
        if (!$id) {
            http_response_code(400);
            echo json_encode(["error" => "Invalid ID"]);
            exit;
        }
        try {
            $stmt = $pdo->prepare("DELETE FROM tasks WHERE id = ?");
            $stmt->execute([$id]);
            echo json_encode(["success" => true]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode(["error" => $e->getMessage()]);
        }
        exit;
    }

    http_response_code(405);
    echo json_encode(["error" => "Method not allowed"]);
?>
