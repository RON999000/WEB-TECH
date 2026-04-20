<?php
$conn = new mysqli("localhost", "root", "", "study_planner");

if ($conn->connect_error) {
    die("Connection failed: " . $conn->connect_error);
}
?>
