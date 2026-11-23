---
layout: ../../layouts/LessonLayout.astro
title: Superposition
description: A qubit can exist in a superposition of |0⟩ and |1⟩ at once.
---

# Superposition

A qubit doesn't have to be just |0⟩ or |1⟩. It can exist in a **superposition**
of both states simultaneously.

The state vector below starts in the equal superposition |+⟩, equal parts |0⟩
and |1⟩:

:::row

:::state-vector
state: "|+⟩"
format: symbolic
:::

:::probability
state: "|+⟩"
:::

When we measure, we get |0⟩ or |1⟩ with equal probability. The probability bars
above show both outcomes at 50%.

## A two-qubit state

Two qubits work the same way. Here both have a definite value, so there is a
single term. Try changing the `state` value in the markdown source:

:::state-vector
state: "|01⟩"
:::
