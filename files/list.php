<?php

// Check if we are a user
OCP\User::checkLoggedIn();

$tmpl = new OCP\Template('circles', 'files/list', '');
$tmpl->printPage();
