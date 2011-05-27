<h1>Session Data</h1>
<p>This session data is set up in auth/processAuthentication.php from data received from the ccsAuth SOAP service.  It can be altered to suite your needs by editing that file. </p>
<p><b>NOTE:</b> The data coming back from ccsAuth is customizable. If there is additional information you need, or information here that you don't, send email to Rick or Steve to configure your site or see the ccsAuth SOAP service code. </p>
<hr />
<pre>
<?php
include_once("../privateSite.inc");
/* SEE NOTE about this session manager in ../index.php */
include_once("../library/includes/authSession.inc");
session_start();

print "ccsAuth nonce &amp; Session ID: " . session_id() . "\n\n";

print_r($_SESSION);
?>
</pre>