<?php
$messageSent = false;

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $name = htmlspecialchars($_POST["name"]);
    $email = htmlspecialchars($_POST["email"]);
    $message = htmlspecialchars($_POST["message"]);

    // Here you could store in DB or send email
    // mail($to, $subject, $message);  ← optional if configured

    $messageSent = true;
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Ron | Contact</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>

<header>
    <h1>Contact Me 🐌</h1>
</header>

<nav>
    <a href="index.html">Home</a>
    <a href="about.html">About</a>
    <a href="skills.html">Skills</a>
</nav>

<section>

    <p>Email: <span style="color:#4e54c8; font-weight:bold;">Rohan@gmail.com</span></p>
    <p>Phone: +91 9876543210</p>

    <p>
        GitHub:
        <a href="https://github.com/RON999000" target="_blank">
            github.com/RON999000
        </a>
    </p>

    <h2>Send a Message ✉️</h2>

    <?php if ($messageSent): ?>
        <p style="color:green; font-weight:bold;">
            Message sent successfully. Someone might even read it.
        </p>
    <?php endif; ?>

    <form method="POST" action="">
        <input type="text" name="name" placeholder="Your Name" required>
        <input type="email" name="email" placeholder="Your Email" required>
        <textarea name="message" rows="5" placeholder="Your Message"></textarea>
        <button type="submit">Send</button>
    </form>

</section>

<footer>
    <p>Contact Page</p>
</footer>

</body>
</html>