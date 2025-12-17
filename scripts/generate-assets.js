#!/usr/bin/env node

/**
 * Script to generate placeholder assets for Expo app
 * Run with: node scripts/generate-assets.js
 */

const fs = require('fs');
const path = require('path');

const assetsDir = path.join(__dirname, '..', 'assets');

// Ensure assets directory exists
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Create a simple SVG-based placeholder function
function createPlaceholderSVG(size, text, bgColor = '#ffffff', textColor = '#000000') {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${bgColor}"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.2}" 
        fill="${textColor}" text-anchor="middle" dominant-baseline="middle">${text}</text>
</svg>`;
}

// Note: This script creates SVG placeholders
// For actual PNG assets, you'll need to:
// 1. Use an online tool like https://www.favicon-generator.org/
// 2. Use ImageMagick: convert -size 1024x1024 xc:white icon.png
// 3. Use a design tool to create proper assets

console.log('📦 Asset Generation Script');
console.log('==========================\n');
console.log('This script creates placeholder SVG files.');
console.log('For production, you should replace these with proper PNG assets.\n');

const assets = [
  { name: 'icon.png', size: 1024, text: 'Icon', note: 'App icon (1024x1024 PNG)' },
  { name: 'splash.png', size: 1242, text: 'Splash', note: 'Splash screen (1242x2436 PNG recommended)' },
  { name: 'adaptive-icon.png', size: 1024, text: 'Adaptive', note: 'Android adaptive icon (1024x1024 PNG)' },
  { name: 'favicon.png', size: 48, text: 'F', note: 'Web favicon (48x48 PNG)' },
  { name: 'notification-icon.png', size: 96, text: 'N', note: 'Notification icon (96x96 PNG)' },
];

console.log('Required assets:');
assets.forEach(asset => {
  const filePath = path.join(assetsDir, asset.name);
  const exists = fs.existsSync(filePath);
  console.log(`  ${exists ? '✅' : '❌'} ${asset.name} - ${asset.note}`);
});

console.log('\n💡 To create proper PNG assets:');
console.log('   1. Use a design tool (Figma, Photoshop, etc.)');
console.log('   2. Export at the specified sizes');
console.log('   3. Place them in the assets/ folder');
console.log('\n📝 For now, the notification icon has been made optional in app.config.js');

