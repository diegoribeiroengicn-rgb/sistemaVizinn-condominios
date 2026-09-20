"use client";

import { loadStripe } from "@stripe/stripe-js";

let stripePromise;

// Client-side singleton loader for Stripe.js, keyed off the public key.
export function getStripeClient() {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY;
    stripePromise = key ? loadStripe(key) : Promise.resolve(null);
  }
  return stripePromise;
}
