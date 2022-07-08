import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import {
  Contract,
  Auction_BidPlaced,
  Auction_BidRemoved,
  Auction_EndTimeUpdated,
  Auction_IncentivePaid,
  Auction_Initialized,
  Auction_StartTimeUpdated,
  Contract_BiddingAllowed,
  Auction_ItemClaimed,
  AuctionCancelled,
} from "../generated/Contract/Contract"
import {
  Auction,
  Bid,
  Statistic,
  Incentive,
  User,
  Contract as ContractEntity
} from "../generated/schema";
import { getOrCreateBid, getOrCreateUser } from "./helper";

export function handleAuction_BidPlaced(event: Auction_BidPlaced): void {
  //Auction
  log.warning("handleAuction_BidPlaced, auctionId = {}", [event.params._auctionID.toString()])
  let auction = Auction.load(event.params._auctionID.toString());
  if(!auction) {
    log.warning("auction with id {} not found", [event.params._auctionID.toString()])
    return;
  }
  let bid = getOrCreateBid(event.params._bidder, event.params._bidAmount, auction, event);

  //Set new bid
  auction.totalBids = auction.totalBids.plus(BigInt.fromI32(1));
  auction.lastBidTime = event.block.timestamp;
  auction.highestBid = event.params._bidAmount;
  auction.highestBidder = event.params._bidder;

  //Update user
  let user = getOrCreateUser(event.params._bidder);
  user.bids = user.bids.plus(BigInt.fromI32(1));
  user.bidAmount = user.bidAmount.plus(event.params._bidAmount);

  user.save();
  auction.save();
  bid.save();
}

export function handleAuction_BidRemoved(event: Auction_BidRemoved): void {
  let auction = Auction.load(event.params._auctionID.toString());
  if(!auction) {
    log.warning("auction with id {} not found", [event.params._auctionID.toString()])
    return;
  }
  let entity = getOrCreateBid(event.params._bidder, event.params._bidAmount, auction as Auction, event);

  //Update user
  let user = getOrCreateUser(event.params._bidder);
  user.outbids = user.outbids.plus(BigInt.fromI32(1));

  entity.outbid = true;
  entity.save();
  user.save();
}

export function handleAuction_EndTimeUpdated(
  event: Auction_EndTimeUpdated
): void {
  let entity = Auction.load(event.params._auctionID.toString());
  if(!entity) {
    log.warning("auction with id {} not found", [event.params._auctionID.toString()])
    return;
  }
  entity.endsAt = event.params._endTime;
  entity.save();
}

export function handleAuction_IncentivePaid(
  event: Auction_IncentivePaid
): void {
  let incentiveId =
    event.params._auctionID.toString() +
    "_" +
    event.params._earner.toHexString() +
    "_" +
    event.params._incentiveAmount.toString();

  let incentive = Incentive.load(incentiveId);

  if (incentive == null) {
    incentive = new Incentive(incentiveId);
  }

  incentive.amount = event.params._incentiveAmount;
  incentive.earner = event.params._earner;
  incentive.auctionID = event.params._auctionID;
  incentive.receiveTime = event.block.timestamp;

  let auction = Auction.load(event.params._auctionID.toString());
  if(!auction) {
    log.warning("auction with id {} not found", [event.params._auctionID.toString()])
    return;
  }
  incentive.tokenId = auction.tokenId;
  incentive.contractAddress = auction.contractAddress;
  incentive.type = auction.type;
  incentive.auctionOrderId = auction.orderId;
  // @todo: Payouts object: previousBidder


  let user = getOrCreateUser(event.params._earner);
  user.payouts = user.payouts.plus(BigInt.fromI32(1));
  user.payoutAmount = user.payoutAmount.plus(event.params._incentiveAmount);

  user.save();
  incentive.save();
}

export function handleAuction_Initialized(event: Auction_Initialized): void {
  //Update statistics
  let statistics = Statistic.load("0");
  if (statistics == null) {
    statistics = new Statistic("0");
    statistics.erc721Auctions = BigInt.fromI32(0);
    statistics.erc1155Auctions = BigInt.fromI32(0);
  }

  let orderId = BigInt.fromI32(0);
  let type =
    event.params._tokenKind.toHexString() == "0x973bb640"
      ? "erc1155"
      : "erc721";

  if (type == "erc1155") {
    statistics.erc1155Auctions = statistics.erc1155Auctions.plus(
      BigInt.fromI32(1)
    );
    orderId = statistics.erc1155Auctions;
  } else {
    statistics.erc721Auctions = statistics.erc721Auctions.plus(
      BigInt.fromI32(1)
    );
    orderId = statistics.erc721Auctions;
  }
  statistics.save();

  let auction = Auction.load(event.params._auctionID.toString());

  if (auction == null) {
    auction = new Auction(event.params._auctionID.toString());
  }

  auction.orderId = orderId;
  auction.type = type;
  auction.contractAddress = event.params._contractAddress;
  auction.tokenId = event.params._tokenID;
  auction.totalBids = BigInt.fromI32(0);
  auction.claimed = false;
  auction.lastBidTime = BigInt.fromI32(0);
  auction.highestBid = BigInt.fromI32(0);
  auction.highestBidder = Address.fromString(
    "0x0000000000000000000000000000000000000000"
  );
  auction.cancelled = false;

  //Fetch auction info from contract
  let contract = Contract.bind(event.address);

  let result = contract.try_getAuctionInfo(event.params._auctionID);

  // @todo: seller, createdAt, startsAt, endsAt, claimAt, 
  //  contractId quantity, presetId, cancelled, ercType, bids objects
  if (!result.reverted) {
    let auctionInfo = result.value;

    auctionInfo.auctionDebt
    auctionInfo.biddingAllowed
    auction.claimed = auctionInfo.claimed

    let presets = auctionInfo.presets;
    auction.bidDecimals = presets.bidDecimals
    auction.bidMultiplier = presets.bidMultiplier
    auction.hammerTimeDuration = BigInt.fromI32(presets.hammerTimeDuration)
    auction.incMax = presets.incMax
    auction.incMin = presets.incMin
    auction.stepMin = presets.stepMin
    auction.seller = auctionInfo.owner;
    auction.createdAt = event.block.timestamp;
    auction.quantity = event.params._tokenAmount;
    
    // auction.endsAt = 
    // auction.claimAt = 
    auction.highestBidder = auctionInfo.highestBidder;

  }

  auction.save();

  let contractEntity = ContractEntity.load(
    event.params._contractAddress.toHexString()
  );
  if (contractEntity == null) {
    contractEntity = new ContractEntity(event.params._contractAddress.toHexString());
    contractEntity.biddingAllowed = false;
  }

  contractEntity.save();
}

export function handleAuction_StartTimeUpdated(
  event: Auction_StartTimeUpdated
): void {
  let entity = Auction.load(event.params._auctionID.toString());
  if(!entity) {
    log.warning("auction with id {} not found", [event.params._auctionID.toString()])
    return;
  }
  entity.startAt = event.params._startTime;
  entity.save();
}

export function handleContract_BiddingAllowed(
  event: Contract_BiddingAllowed
): void {
  let entity = ContractEntity.load(event.params._contract.toHexString());
  if (entity == null) {
    entity = new ContractEntity(event.params._contract.toHexString());
  }
  entity.biddingAllowed = event.params._biddingAllowed;
  entity.save();
}

export function handleAuction_ItemClaimed(event: Auction_ItemClaimed): void {
  let auction = Auction.load(event.params._auctionID.toString());
  if(!auction) {
    log.warning("auction with id {} not found", [event.params._auctionID.toString()])
    return;
  }
  auction.claimed = true;

  let bid = getOrCreateBid(auction.highestBidder, auction.highestBid, auction as Auction, event);
  bid.claimed = true;

  let user = getOrCreateUser(auction.highestBidder);
  user.wins = user.wins.plus(BigInt.fromI32(1));

  user.save();

  bid.save();
  auction.save();
}

export function handleAuctionCancelled(event: AuctionCancelled): void {
  let auction = Auction.load(event.params._auctionId.toString());
  if(!auction) {
    log.warning("auction with id {} not found", [event.params._auctionId.toString()])
    return;
  }
  auction.cancelled = true;
  auction.save();
}