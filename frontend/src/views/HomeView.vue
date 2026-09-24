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
import { useAnalyticsStore } from '@/stores';
import { onMounted, ref } from 'vue';

const analytics = useAnalyticsStore();

const heroRef = ref<InstanceType<typeof LandingHero> | null>(null);
const howItWorksRef = ref<InstanceType<typeof HowItWorks> | null>(null);
const crossChainRef = ref<InstanceType<typeof CrossChainDeepDive> | null>(null);
const featuresRef = ref<InstanceType<typeof FeaturesBento> | null>(null);
const activityRef = ref<InstanceType<typeof ActivityTicker> | null>(null);
const buildersRef = ref<InstanceType<typeof BuildersTrust> | null>(null);
const faqRef = ref<InstanceType<typeof FaqSection> | null>(null);
const ctaRef = ref<InstanceType<typeof ClosingCta> | null>(null);

onMounted(() => {
  const sections = [
    { ref: heroRef, name: 'hero' },
    { ref: howItWorksRef, name: 'how_it_works' },
    { ref: crossChainRef, name: 'cross_chain' },
    { ref: featuresRef, name: 'features' },
    { ref: activityRef, name: 'activity_ticker' },
    { ref: buildersRef, name: 'builders_trust' },
    { ref: faqRef, name: 'faq' },
    { ref: ctaRef, name: 'closing_cta' },
  ];

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const name = (entry.target as HTMLElement).dataset.cbSection;
        if (name) {
          analytics.recordEvent('section_viewed', { section: name });
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.25 }
  );

  sections.forEach((s) => {
    const el = (s.ref.value as any)?.$el as HTMLElement | undefined;
    if (el) {
      el.dataset.cbSection = s.name;
      observer.observe(el);
    }
  });
});
</script>

<template>
  <div class="max-w-7xl mx-auto">
    <LandingHero ref="heroRef" />
    <HowItWorks ref="howItWorksRef" />
    <CrossChainDeepDive ref="crossChainRef" />
    <FeaturesBento ref="featuresRef" />
    <ActivityTicker ref="activityRef" />
    <BuildersTrust ref="buildersRef" />
    <FaqSection ref="faqRef" />
    <ClosingCta ref="ctaRef" />
  </div>
</template>
