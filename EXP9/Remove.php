<?php
session_start();

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $id = $_POST['id'];

    foreach ($_SESSION['cart'] as $key => $item) {
        if ($item['id'] == $id) {
            unset($_SESSION['cart'][$key]);
            break;
        }
    }

    // Re-index array
    $_SESSION['cart'] = array_values($_SESSION['cart']);
}

header("Location: cart.php");
exit();