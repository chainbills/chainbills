<script setup>
import { WalletMultiButton } from 'solana-wallets-vue';

const isDark = () => document.body.classList.contains('dark');
</script>

<template>
  <wallet-multi-button :dark="isDark()"></wallet-multi-button>
</template>
