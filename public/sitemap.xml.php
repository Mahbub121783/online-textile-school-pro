<?php
// Dynamic sitemap proxy — fetches fresh sitemap from Supabase edge function
header('Content-Type: application/xml; charset=utf-8');
header('Cache-Control: public, max-age=3600'); // Cache 1 hour
header('X-Robots-Tag: noindex'); // Sitemap itself shouldn't be indexed

$url = 'https://kaiiyssrwkapromkfidv.supabase.co/functions/v1/sitemap';

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 200 && $response) {
    echo $response;
} else {
    // Fallback minimal sitemap
    echo '<?xml version="1.0" encoding="UTF-8"?>';
    echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
    echo '<url><loc>https://onlinetextileschool.com/</loc><priority>1.0</priority></url>';
    echo '<url><loc>https://onlinetextileschool.com/courses</loc><priority>0.9</priority></url>';
    echo '<url><loc>https://onlinetextileschool.com/ebooks</loc><priority>0.8</priority></url>';
    echo '<url><loc>https://onlinetextileschool.com/blog</loc><priority>0.8</priority></url>';
    echo '</urlset>';
}
?>