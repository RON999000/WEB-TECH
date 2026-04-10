<?php
session_start();

// Initialize cart
if (!isset($_SESSION['cart'])) {
    $_SESSION['cart'] = [];
}

// Add item to cart (with quantity handling)
if ($_SERVER["REQUEST_METHOD"] == "POST") {

    $id = $_POST['id'];
    $found = false;

    foreach ($_SESSION['cart'] as $key => $item) {
        if ($item['id'] == $id) {
            $_SESSION['cart'][$key]['quantity'] += 1;
            $found = true;
            break;
        }
    }

    if (!$found) {
        $_SESSION['cart'][] = [
            "id" => $_POST['id'],
            "name" => $_POST['name'],
            "price" => $_POST['price'],
            "image" => $_POST['image'],
            "quantity" => 1
        ];
    }

    header("Location: cart.php");
    exit();
}
?>

<!DOCTYPE html>
<html>
<head>
    <title>ShopEase | Cart</title>
    <link rel="stylesheet" href="style.css">

    <style>
        .product-container {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
        }

        article {
            width: 220px;
            border: 1px solid #ccc;
            padding: 10px;
            text-align: center;
            box-sizing: border-box;
        }

        article img {
            max-width: 100%;
            height: auto;
        }

        .button {
            background-color: #060f18;
            color: white;
            border: none;
            padding: 5px 20px;
            cursor: pointer;
        }
    </style>
</head>
<body>

<header>
    <h1>Your Cart</h1>
</header>

<nav>
    <a href="index.html">Home</a>
    <a href="product.php">Products</a>
    <a href="offers.html">Offers</a>
    <a href="contact.html">Contact</a>
    <a href="sneakers.php">Sneakers</a>
</nav>

<section class="product-container">

<?php
if (count($_SESSION['cart']) > 0) {
    $total = 0;

    foreach ($_SESSION['cart'] as $item) {
?>
        <article>
            <p><strong><?php echo $item['name']; ?></strong></p>
            <p>₹<?php echo $item['price']; ?></p>
            <p>Qty: <?php echo $item['quantity']; ?></p>
            <img src="<?php echo $item['image']; ?>">

            <!-- Remove Button -->
            <form method="POST" action="remove.php">
                <input type="hidden" name="id" value="<?php echo $item['id']; ?>">
                <button class="button">Remove</button>
            </form>
        </article>
<?php
        $total += $item['price'] * $item['quantity'];
    }

    echo "<h3 style='width:100%;'>Total: ₹".$total."</h3>";

} else {
    echo "<p>Your cart is empty.</p>";
}
?>

</section>

<footer>
    <p>Cart Page</p>
</footer>

</body>
</html>