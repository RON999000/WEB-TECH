<!DOCTYPE html>
<html>
<head>
    <title>ShopEase | Products</title>
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
    <h1>FOR MEN</h1>
</header>

<nav>
    <a href="index.html">Home</a>
    <a href="offers.html">Offers</a>
    <a href="cart.php">Cart</a>
    <a href="contact.html">Contact</a>
    <a href="sneakers.php">Sneakers</a>
</nav>

<?php include 'db.php'; ?>

<section class="product-container">

<?php
$sql = "SELECT * FROM products";
$result = $conn->query($sql);

while($row = $result->fetch_assoc()) {
?>
    <article>
        <img src="<?php echo $row['image']; ?>">
        <p><strong><?php echo $row['name']; ?></strong></p>
        <p>₹<?php echo $row['price']; ?></p>

        <form method="POST" action="cart.php">
            <input type="hidden" name="id" value="<?php echo $row['id']; ?>">
            <input type="hidden" name="name" value="<?php echo $row['name']; ?>">
            <input type="hidden" name="price" value="<?php echo $row['price']; ?>">
            <input type="hidden" name="image" value="<?php echo $row['image']; ?>">
            <button class="button">Add to Cart</button>
        </form>
    </article>
<?php } ?>

</section>

<footer>
    <p>Products Page</p>
</footer>

</body>
</html>