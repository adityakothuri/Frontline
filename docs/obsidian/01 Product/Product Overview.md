---
tags: [product, source-of-truth]
status: stable
updated: 2026-07-05
---

# Product Overview

> **Watchdog — Neighborhood safety, verified by people.**

## The problem

Neighborhood safety apps today have two failure modes: they either post raw camera footage
publicly (a privacy nightmare) or they flood people with unverified, fear-inducing alerts.
Both erode trust. People want to know what's happening near them **without** surveilling
their neighbors or drowning in false alarms.

## The idea

Watchdog connects (or simulates) home cameras, Ring-style doorbells, and security feeds. AI
**watches for** suspicious or potentially unsafe events — but it never posts anything publicly
on its own. When something concerning is detected, the app notifies the owner and creates an
**in-app review item**.

The user opens the app, reviews the flagged clip/event, and decides whether the detection is
valid. If they approve it, they can post a **public neighborhood alert** — with a description,
location, a video/thumbnail, and an **auto-delete expiration**. Nearby users open a map, tap
the alert, and see the relevant details.

## Target user

A privacy-conscious resident who already has (or would simulate) a camera and wants a calm,
trustworthy way to stay aware of and warn neighbors about real local incidents — without
becoming a surveillance hub or a fear machine.

## Core workflow

1. AI detects a possible incident from a (simulated) camera feed.
2. The owner is notified and reviews it privately.
3. The owner approves or rejects. **Only approval makes it public.**
4. An approved alert appears on a neighborhood map with an expiration.
5. Nearby users view it; it auto-deletes when it expires.

## Why human approval matters

This is the core differentiator. **AI assists; people decide.** Nothing from a private camera
becomes public automatically. This single rule drives the privacy model, the UX, and the
product's trustworthiness. See [[Product Principles]].

## What it should feel like

Serious, polished, trustworthy public-safety software — not a hackathon app, a police
scanner, or a social feed. See [[UI Design System]] and [[Anti-AI-Slop Design Rules]].

## Related

[[MVP Definition]] · [[Feature Priority Order]] · [[Product Principles]] · [[App Flow]] · [[Watchdog Command Center]]
