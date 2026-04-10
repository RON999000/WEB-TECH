<?php
$conn = new mysqli("localhost", "root", "", "shopease");

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
?>