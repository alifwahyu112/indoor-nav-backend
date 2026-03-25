<?php
$password_asli = "alifwahyu112";
$password_hash = password_hash($password_asli, PASSWORD_DEFAULT);

echo "<h3>Copy kode di bawah ini:</h3>";
echo "<textarea rows='4' cols='50'>" . $password_hash . "</textarea>";
echo "<br><br>Lalu paste ke kolom 'password' di database phpMyAdmin.";
?>