/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // Lägg till detta om du använder statiska sidor
  trailingSlash: true,
}

module.exports = nextConfig 