import { ethers, upgrades } from 'hardhat';

export const green = (input: any) => '\x1b[32m' + input + '\x1b[0m';

export const showBalance = async () => {
  const owner = (await ethers.getSigners())[0];
  const balance = await ethers.provider.getBalance(owner.address);
  console.log(`Owner's Balance: ${green(ethers.formatEther(balance))}`);
};

const CHAINBILLS_ADDRESS = '0x89F1051407799805eac5aE9A40240dbCaaB55b98';

const main = async () => {
  await showBalance();
  console.log('Upgrading Chainbills ...');
  const factory = await ethers.getContractFactory('Chainbills');
  await upgrades.forceImport(CHAINBILLS_ADDRESS, factory, {
    kind: 'transparent',
  });
  const chainbills = await upgrades.upgradeProxy(CHAINBILLS_ADDRESS, factory);
  console.log('Waiting Confirmation ...');
  await chainbills.waitForDeployment();
  console.log('Chainbills updated to: ', green(await chainbills.getAddress()));
  await showBalance();
};

main().then().catch(console.error);
