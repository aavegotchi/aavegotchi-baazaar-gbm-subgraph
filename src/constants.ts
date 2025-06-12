import { BigInt } from "@graphprotocol/graph-ts";

export let BIGINT_ZERO = BigInt.fromI32(0);
export let BIGINT_ONE = BigInt.fromI32(1);

export let BIGINT_CANCELLATION_PERIOD_IN_SECONDS = BigInt.fromI32(3600);
export let BIGINT_STARTING_BID_FEE_PERCENT = BigInt.fromI32(4);

// TODO: Needs to be updated to activated block number
const NR_BLOCK_BUY_NOW_ACTIVATED_POLYGON = 55931248;
const NR_BLOCK_BUY_NOW_ACTIVATED_BASE = 10000000;
const NR_BLOCK_BUY_NOW_ACTIVATED_BASE_SEPOLIA = 10000000;

export let BLOCK_NR_BUY_NOW_ACTIVATED = BigInt.fromI32(
  NR_BLOCK_BUY_NOW_ACTIVATED_POLYGON
);
