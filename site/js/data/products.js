// Marketia China - Multilingual Products & Sourcing Catalog Data
export let productsData = [];

export async function loadProducts() {
  const res = await fetch('/api/products');
  const data = await res.json();
  productsData.length = 0;
  productsData.push(...data.products);
}
