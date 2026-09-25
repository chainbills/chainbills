<script setup lang="ts">
/**
 * src/components/landing/FaqSection.vue — the landing page's ninth section:
 * a glass-styled PrimeVue `Accordion` answering the questions a first-time
 * visitor is most likely to have.
 *
 * The PrimeVue theme preset (`main.ts`) does not style
 * `Accordion` specifically, so this component's own `:deep()` rules give it
 * the glass-surface look used everywhere else rather than PrimeVue's default
 * flat panel.
 *
 * Usage: `<FaqSection />` inside `HomeView.vue`.
 */
import { SectionHeader } from '@/components/ui';
import { useAnalyticsStore } from '@/stores';
import Accordion from 'primevue/accordion';
import AccordionContent from 'primevue/accordioncontent';
import AccordionHeader from 'primevue/accordionheader';
import AccordionPanel from 'primevue/accordionpanel';
import { computed, ref } from 'vue';

const faqs = [
  {
    question: 'What is a payable?',
    answer:
      'A payable is a public, shareable invoice. A host creates one, configures what it accepts, and shares its link — anyone can pay it from any supported chain.',
  },
  {
    question: 'How long do cross-chain payments take?',
    answer:
      "Usually 1-3 minutes: the payer's wallet burns funds via Circle CCTP, Circle attests to the burn, and the Chainbills relayer submits that attestation on the payable's home chain.",
  },
  {
    question: 'What are the fees?',
    answer:
      "A flat 2% is taken when an owner withdraws — nothing is taken from the payer, and there's no subscription or setup cost.",
  },
  {
    question: 'Can I restrict what a payable accepts?',
    answer:
      'Yes. Lock a payable to specific tokens and exact amounts, or leave it open to accept any amount of any supported token.',
  },
  {
    question: 'Is Chainbills custodial?',
    answer:
      "No. Funds sit in the Chainbills contract on the payable's own chain until the owner withdraws them — Chainbills never takes custody.",
  },
  {
    question: 'What is auto-withdraw?',
    answer:
      "A per-payable setting that sweeps every incoming payment straight to the host's wallet automatically, instead of waiting for a manual withdrawal.",
  },
];

const analytics = useAnalyticsStore();
const activePanels = ref<string[]>(faqs.map((_, i) => String(i)));

const allExpanded = computed(() => activePanels.value.length === faqs.length);

const toggleAll = () => {
  if (allExpanded.value) {
    activePanels.value = [];
    analytics.recordEvent('faq_collapsed_all');
  } else {
    activePanels.value = faqs.map((_, i) => String(i));
    analytics.recordEvent('faq_expanded_all');
  }
};

const onFaqChange = (newVal: string | string[] | null | undefined) => {
  const next = Array.isArray(newVal) ? newVal : newVal != null ? [newVal] : [];
  const prev = activePanels.value;
  next
    .filter((v) => !prev.includes(v))
    .forEach((v) => {
      analytics.recordEvent('faq_expanded', { question: faqs[parseInt(v)]?.question });
    });
  prev
    .filter((v) => !next.includes(v))
    .forEach((v) => {
      analytics.recordEvent('faq_collapsed', { question: faqs[parseInt(v)]?.question });
    });
  activePanels.value = next;
};
</script>

<template>
  <section class="py-10 sm:py-14">
    <SectionHeader eyebrow="FAQ" title="Questions," accent-tail="answered." />

    <div class="max-w-4xl">
      <div class="flex justify-end mb-4">
        <button
          type="button"
          class="text-xs font-medium text-muted hover:text-fg border border-glass-border rounded-full px-3 py-1.5 transition-colors"
          @click="toggleAll"
        >
          {{ allExpanded ? 'Collapse all' : 'Expand all' }}
        </button>
      </div>

      <Accordion multiple :value="activePanels" class="cb-faq-accordion" @update:value="onFaqChange">
        <AccordionPanel v-for="(faq, i) in faqs" :key="faq.question" :value="String(i)" v-reveal="{ delay: i * 40 }">
          <AccordionHeader>{{ faq.question }}</AccordionHeader>
          <AccordionContent>
            <p class="text-sm text-muted pt-4 pb-3">{{ faq.answer }}</p>
          </AccordionContent>
        </AccordionPanel>
      </Accordion>
    </div>
  </section>
</template>

<style scoped>
/* Glass-surface restyle of PrimeVue's Accordion, matching the rest of the
   app's cards rather than the default flat panel. Each panel is its own
   glass card with a hairline border; the header row is the clickable
   surface, and the content slides in under it when expanded. */
.cb-faq-accordion :deep(.p-accordionpanel) {
  background: var(--glass-tint);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  margin-bottom: 1rem;
  overflow: hidden;
}
.cb-faq-accordion :deep(.p-accordionheader) {
  background: transparent;
  color: var(--fg);
  font-weight: 500;
  padding: 1.125rem 1.5rem;
}
.cb-faq-accordion :deep(.p-accordioncontent-content) {
  padding: 0 1.5rem;
  padding-bottom: 0.25rem;
}
.cb-faq-accordion :deep(.p-accordioncontent-content p) {
  padding-bottom: 1.25rem;
  line-height: 1.7;
}
.cb-faq-accordion :deep(.p-accordionpanel-active .p-accordionheader) {
  color: var(--accent);
}
</style>
