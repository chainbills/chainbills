<script setup lang="ts">
/**
 * src/views/HomeView.vue — the landing page (`/`).
 *
 * Composes the ten sections documented in `src/components/landing/README.md`
 * in order: hero, numbers strip, how it works, cross-chain deep dive,
 * features bento, activity ticker, supported chains, builders/trust, FAQ and
 * the closing CTA. This view holds no logic of its own — every section is a
 * self-contained component under `src/components/landing/`, and every
 * number or sample activity they show comes from
 * `src/components/landing/placeholders.ts`. The page performs no on-chain or
 * server reads at all.
 */
import ActivityTicker from '@/components/landing/ActivityTicker.vue';
import BuildersTrust from '@/components/landing/BuildersTrust.vue';
import ClosingCta from '@/components/landing/ClosingCta.vue';
import CrossChainDeepDive from '@/components/landing/CrossChainDeepDive.vue';
import FaqSection from '@/components/landing/FaqSection.vue';
import FeaturesBento from '@/components/landing/FeaturesBento.vue';
import HowItWorks from '@/components/landing/HowItWorks.vue';
import LandingHero from '@/components/landing/LandingHero.vue';
import NumbersStrip from '@/components/landing/NumbersStrip.vue';
import SupportedChains from '@/components/landing/SupportedChains.vue';
</script>

<template>
  <div class="max-w-7xl mx-auto">
    <LandingHero />
    <NumbersStrip />
    <HowItWorks />
    <CrossChainDeepDive />
    <FeaturesBento />
    <ActivityTicker />
    <SupportedChains />
    <BuildersTrust />
    <FaqSection />
    <ClosingCta />
  </div>
</template>
