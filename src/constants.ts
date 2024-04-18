import { BigInt } from "@graphprotocol/graph-ts";

export let BIGINT_ZERO = BigInt.fromI32(0);
export let BIGINT_ONE = BigInt.fromI32(1);

export let BIGINT_CANCELLATION_PERIOD_IN_SECONDS = BigInt.fromI32(3600);

// TODO: Needs to be updated to activated block number
export let BLOCK_NR_BUY_NOW_ACTIVATED = BigInt.fromI32(55931248);