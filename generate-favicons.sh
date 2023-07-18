#!/bin/bash

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "ImageMagick is required but not installed. Please install it first."
    exit 1
fi

# Create required directories
mkdir -p icons/splash icons/manifest icons/apple

# Generate PWA manifest icons
sizes=(72 96 128 144 152 192 384 512)
for size in "${sizes[@]}"; do
    convert -background none -resize ${size}x${size} favicon.svg "icons/manifest/icon-${size}x${size}.png"
done

# Generate Apple touch icons
convert -background none -resize 180x180 favicon.svg "icons/apple/apple-touch-icon.png"
convert -background none -resize 152x152 favicon.svg "icons/apple/touch-icon-ipad.png"
convert -background none -resize 167x167 favicon.svg "icons/apple/touch-icon-ipad-retina.png"

# Generate iOS splash screens
# iPhone 5
convert -size 640x1136 xc:#ffffff -gravity center favicon.svg -resize 320x320 -composite "icons/splash/iphone5_splash.png"
# iPhone 6/7/8
convert -size 750x1334 xc:#ffffff -gravity center favicon.svg -resize 375x375 -composite "icons/splash/iphone6_splash.png"
# iPhone 6+/7+/8+
convert -size 1242x2208 xc:#ffffff -gravity center favicon.svg -resize 621x621 -composite "icons/splash/iphoneplus_splash.png"
# iPhone X/XS
convert -size 1125x2436 xc:#ffffff -gravity center favicon.svg -resize 375x375 -composite "icons/splash/iphonex_splash.png"
# iPhone XR
convert -size 828x1792 xc:#ffffff -gravity center favicon.svg -resize 414x414 -composite "icons/splash/iphonexr_splash.png"
# iPhone XS Max
convert -size 1242x2688 xc:#ffffff -gravity center favicon.svg -resize 414x414 -composite "icons/splash/iphonexsmax_splash.png"
# iPad
convert -size 1536x2048 xc:#ffffff -gravity center favicon.svg -resize 768x768 -composite "icons/splash/ipad_splash.png"
# iPad Pro 10.5"
convert -size 1668x2224 xc:#ffffff -gravity center favicon.svg -resize 834x834 -composite "icons/splash/ipadpro1_splash.png"
# iPad Pro 11"
convert -size 1668x2388 xc:#ffffff -gravity center favicon.svg -resize 834x834 -composite "icons/splash/ipadpro2_splash.png"
# iPad Pro 12.9"
convert -size 2048x2732 xc:#ffffff -gravity center favicon.svg -resize 1024x1024 -composite "icons/splash/ipadpro3_splash.png"

# Generate standard favicons
convert -background none -resize 16x16 favicon.svg favicon-16x16.png
convert -background none -resize 32x32 favicon.svg favicon-32x32.png
convert -background none -resize 48x48 favicon.svg favicon-48x48.png

# Generate ICO file with multiple sizes
convert favicon-16x16.png favicon-32x32.png favicon-48x48.png favicon.ico

echo "All icons and splash screens generated successfully!" 