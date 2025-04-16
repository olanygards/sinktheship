const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [192, 512];
const inputImage = path.join(__dirname, '../public/images/icon.svg');
const outputDir = path.join(__dirname, '../public/icons');

// Create icons directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Generate icons for each size
sizes.forEach(size => {
  sharp(inputImage)
    .resize(size, size)
    .png()
    .toFile(path.join(outputDir, `icon-${size}x${size}.png`))
    .then(() => {
      console.log(`Generated ${size}x${size} icon`);
    })
    .catch(err => {
      console.error(`Error generating ${size}x${size} icon:`, err);
    });
}); 