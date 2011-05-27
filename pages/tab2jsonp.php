<?php
$html = "<p>This is tab2 content from the server.</p><script>$('p').css('color','green');alert('I love it!')</script>";

print <<<EOD
{$_REQUEST['callback']}({html:"$html"});
EOD;
?>
