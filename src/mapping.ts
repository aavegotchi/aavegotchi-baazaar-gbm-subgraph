import { BigInt } from "@graphprotocol/graph-ts"
import {
  Contract,
  AuctionCancelled,
  Auction_BidPlaced,
  Auction_BidRemoved,
  Auction_EndTimeUpdated,
  Auction_IncentivePaid,
  Auction_Initialized,
  Auction_ItemClaimed,
  Auction_StartTimeUpdated,
  Contract_BiddingAllowed
} from "../generated/Contract/Contract"
import { ExampleEntity } from "../generated/schema"

export function handleAuctionCancelled(event: AuctionCancelled): void {
  // Entities can be loaded from the store using a string ID; this ID
  // needs to be unique across all entities of the same type
  let entity = ExampleEntity.load(event.transaction.from.toHex())

  // Entities only exist after they have been saved to the store;
  // `null` checks allow to create entities on demand
  if (entity == null) {
    entity = new ExampleEntity(event.transaction.from.toHex())

    // Entity fields can be set using simple assignments
    entity.count = BigInt.fromI32(0)
  }

  // BigInt and BigDecimal math are supported
  entity.count = entity.count + BigInt.fromI32(1)

  // Entity fields can be set based on event parameters
  entity._auctionId = event.params._auctionId
  entity._tokenId = event.params._tokenId

  // Entities can be written to the store with `.save()`
  entity.save()

  // Note: If a handler doesn't require existing field values, it is faster
  // _not_ to load the entity from the store. Instead, create it fresh with
  // `new Entity(...)`, set the fields that should be updated and save the
  // entity back to the store. Fields that were not set or unset remain
  // unchanged, allowing for partial updates to be applied.

  // It is also possible to access smart contracts from mappings. For
  // example, the contract that has emitted the event can be connected to
  // with:
  //
  // let contract = Contract.bind(event.address)
  //
  // The following functions can then be called on this contract to access
  // state variables and other data:
  //
  // - contract.checkIndex(...)
  // - contract.checkPubKey(...)
  // - contract.createAuction(...)
  // - contract.getAuctionBidDecimals(...)
  // - contract.getAuctionBidMultiplier(...)
  // - contract.getAuctionDebt(...)
  // - contract.getAuctionDueIncentives(...)
  // - contract.getAuctionEndTime(...)
  // - contract.getAuctionHammerTimeDuration(...)
  // - contract.getAuctionHighestBid(...)
  // - contract.getAuctionHighestBidder(...)
  // - contract.getAuctionIncMax(...)
  // - contract.getAuctionIncMin(...)
  // - contract.getAuctionInfo(...)
  // - contract.getAuctionPresets(...)
  // - contract.getAuctionStartTime(...)
  // - contract.getAuctionStepMin(...)
  // - contract.getContractAddress(...)
  // - contract.getTokenId(...)
  // - contract.getTokenKind(...)
  // - contract.isBiddingAllowed(...)
  // - contract.onERC1155BatchReceived(...)
  // - contract.onERC1155Received(...)
  // - contract.onERC721Received(...)
}

export function handleAuction_BidPlaced(event: Auction_BidPlaced): void {}

export function handleAuction_BidRemoved(event: Auction_BidRemoved): void {}

export function handleAuction_EndTimeUpdated(
  event: Auction_EndTimeUpdated
): void {}

export function handleAuction_IncentivePaid(
  event: Auction_IncentivePaid
): void {}

export function handleAuction_Initialized(event: Auction_Initialized): void {}

export function handleAuction_ItemClaimed(event: Auction_ItemClaimed): void {}

export function handleAuction_StartTimeUpdated(
  event: Auction_StartTimeUpdated
): void {}

export function handleContract_BiddingAllowed(
  event: Contract_BiddingAllowed
): void {}
