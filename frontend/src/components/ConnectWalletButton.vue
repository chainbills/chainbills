<script setup lang="ts">
import { useThemeStore } from '@/stores/theme';
import { WalletMultiButton } from 'solana-wallets-vue';

const theme = useThemeStore();
</script>

<template>
  <wallet-multi-button :dark="theme.isDisplayDark"></wallet-multi-button>
</template>
