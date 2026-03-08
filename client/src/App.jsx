import React from 'react';

const products = [
  {
    name: 'Raw Atlas Mountain Honey',
    size: '500g jar',
    price: '149 MAD',
    note: 'Unfiltered, floral aroma, harvested from wild mountain flowers.'
  },
  {
    name: 'Eucalyptus Honey',
    size: '250g jar',
    price: '89 MAD',
    note: 'Bold flavor with a fresh herbal finish.'
  },
  {
    name: 'Orange Blossom Honey',
    size: '500g jar',
    price: '139 MAD',
    note: 'Light and delicate sweetness, perfect for breakfast.'
  }
];

const steps = [
  'Pick your honey jars and submit the order form.',
  'We confirm your order by phone or WhatsApp.',
  'You receive your package and pay the delivery agent in cash.'
];

export function App() {
  return (
    <div className="site">
      <header className="hero">
        <p className="kicker">Natural Moroccan Honey</p>
        <h1>Premium Honey Store with Cash on Delivery</h1>
        <p className="subtitle">
          Yes — you can absolutely launch a website similar to atlassia.ma and sell honey without online payment.
          This demo uses a clear <strong>Cash on Delivery (COD)</strong> flow so customers pay only when they receive their order.
        </p>
        <a className="cta" href="#order">Order Now (COD)</a>
      </header>

      <main className="content">
        <section>
          <h2>Our Honey Selection</h2>
          <div className="grid">
            {products.map((product) => (
              <article key={product.name} className="card">
                <h3>{product.name}</h3>
                <p className="muted">{product.size}</p>
                <p>{product.note}</p>
                <p className="price">{product.price}</p>
                <button type="button">Add to order</button>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2>How Cash on Delivery Works</h2>
          <div className="steps">
            {steps.map((step, index) => (
              <div key={step} className="step">
                <span>{index + 1}</span>
                <p>{step}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="order" className="order-box">
          <h2>Quick Order Form</h2>
          <p className="muted">No card payment on website — payment is collected on delivery.</p>
          <form>
            <label htmlFor="fullName">Full Name</label>
            <input id="fullName" placeholder="Your full name" />

            <label htmlFor="phone">Phone / WhatsApp</label>
            <input id="phone" placeholder="+212 ..." />

            <label htmlFor="city">City</label>
            <input id="city" placeholder="Casablanca, Rabat, Marrakech..." />

            <label htmlFor="address">Delivery Address</label>
            <input id="address" placeholder="Street, area, building" />

            <button type="button" className="cta">Submit COD Order</button>
          </form>
        </section>
      </main>
    </div>
  );
}
