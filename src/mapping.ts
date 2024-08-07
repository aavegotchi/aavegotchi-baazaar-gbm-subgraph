import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import {
    Auction_BidPlaced as Auction_BidPlacedEvent,
    Auction_BidRemoved as Auction_BidRemovedEvent,
    Auction_EndTimeUpdated as Auction_EndTimeUpdatedEvent,
    Auction_IncentivePaid as Auction_IncentivePaidEvent,
    Auction_Initialized as Auction_InitializedEvent,
    Auction_StartTimeUpdated as Auction_StartTimeUpdatedEvent,
    Contract_BiddingAllowed as Contract_BiddingAllowedEvent,
    Auction_ItemClaimed as Auction_ItemClaimedEvent,
    AuctionCancelled as AuctionCancelledEvent,
    RoyaltyPaid as RoyaltyPaidEvent,
    Auction_BuyItNowUpdated as Auction_BuyItNowUpdatedEvent,
    Auction_StartingPriceUpdated as Auction_StartingPriceUpdatedEvent,
    Auction_BoughtNow as Auction_BoughtNowEvent,
    ContractV1,
} from "../generated/Contract/ContractV1";
import {
    Auction,
    Statistic,
    Contract as ContractEntity,
    Auction_BidRemoved,
    Auction_BidPlaced,
    Auction_EndTimeUpdated,
    Auction_IncentivePaid,
    Auction_Initialized,
    Auction_StartTimeUpdated,
    Contract_BiddingAllowed,
    Auction_ItemClaimed,
    AuctionCancelled,
    Bid,
    Auction_BuyItNowUpdated,
    Auction_StartingPriceUpdated,
    Auction_BoughtNow,
} from "../generated/schema";
import {
    calculateIncentives,
    getOrCreateAuction,
    getOrCreateBid,
    getOrCreateIncentive,
    getOrCreateStatistics,
    getOrCreateUser,
    updateAuction,
    updateProceeds,
} from "./helper";
import { events, transactions } from "@amxx/graphprotocol-utils";
import {
    BIGINT_CANCELLATION_PERIOD_IN_SECONDS,
    BIGINT_ONE, BIGINT_STARTING_BID_FEE_PERCENT,
    BIGINT_ZERO,
} from "./constants";

export function handleAuction_BidPlaced(event: Auction_BidPlacedEvent): void {
    // emitter
    let emitter = getOrCreateUser(event.transaction.from);
    emitter.save();

    // event
    let ev = new Auction_BidPlaced(events.id(event));
    ev.emitter = emitter.id;
    ev.transaction = transactions.log(event).id;
    ev.timestamp = event.block.timestamp;

    ev.auctionId = event.params._auctionID;
    ev.bidder = event.params._bidder;
    ev.bidAmount = event.params._bidAmount;

    // ev.auction = event.params._auctionID.toString();
    ev.save();

    //Auction
    log.warning("handleAuction_BidPlaced, auctionId = {}", [
        event.params._auctionID.toString(),
    ]);
    let auction = getOrCreateAuction(event.params._auctionID, event);
    if (auction === null) {
        log.warning("auction with id {} not found", [
            event.params._auctionID.toString(),
        ]);
        return;
    }
    let bid = getOrCreateBid(
        event.params._bidder,
        event.params._bidAmount,
        auction,
        event
    );

    //Set new bid
    auction.totalBids = auction.totalBids.plus(BigInt.fromI32(1));
    auction.lastBidTime = event.block.timestamp;
    auction.highestBid = event.params._bidAmount;
    auction.highestBidder = event.params._bidder;
    auction.totalBidsVolume = auction.totalBidsVolume.plus(
        event.params._bidAmount
    );

    auction.dueIncentives = calculateIncentives(
        auction,
        event.params._bidAmount
    );

    auction = updateProceeds(auction);

    //Update user
    let user = getOrCreateUser(event.params._bidder);
    user.bids = user.bids.plus(BigInt.fromI32(1));
    user.bidAmount = user.bidAmount.plus(event.params._bidAmount);

    // Update global Stats
    let stats = Statistic.load("0")!;
    stats.totalBidsVolume = stats.totalBidsVolume.plus(event.params._bidAmount);
    stats.save();

    // update contract stats
    let cStats = getOrCreateStatistics(auction.contractAddress);
    cStats.totalBidsVolume = cStats.totalBidsVolume.plus(
        event.params._bidAmount
    );
    cStats.save();

    user.save();
    auction.save();
    bid.save();
}

export function handleAuction_BidRemoved(event: Auction_BidRemovedEvent): void {
    // emitter
    let emitter = getOrCreateUser(event.transaction.from);
    emitter.save();

    // event
    let ev = new Auction_BidRemoved(events.id(event));
    ev.emitter = emitter.id;
    ev.transaction = transactions.log(event).id;
    ev.timestamp = event.block.timestamp;

    ev.auctionId = event.params._auctionID;
    ev.bidder = event.params._bidder;
    ev.bidAmount = event.params._bidAmount;

    // ev.auction = event.params._auctionID.toString();
    ev.save();

    let auction = getOrCreateAuction(event.params._auctionID, event);
    if (auction === null) {
        log.warning("auction with id {} not found", [
            event.params._auctionID.toString(),
        ]);
        return;
    }
    let entity = getOrCreateBid(
        event.params._bidder,
        event.params._bidAmount,
        auction as Auction,
        event
    );

    //Update user
    let user = getOrCreateUser(event.params._bidder);
    user.outbids = user.outbids.plus(BigInt.fromI32(1));

    entity.outbid = true;
    entity.save();
    user.save();
}

export function handleAuction_EndTimeUpdated(
    event: Auction_EndTimeUpdatedEvent
): void {
    // emitter
    let emitter = getOrCreateUser(event.transaction.from);
    emitter.save();

    // event
    let ev = new Auction_EndTimeUpdated(events.id(event));
    ev.emitter = emitter.id;
    ev.transaction = transactions.log(event).id;
    ev.timestamp = event.block.timestamp;

    ev.auctionId = event.params._auctionID;
    ev.endTime = event.params._endTime;

    // ev.auction = event.params._auctionID.toString();
    ev.save();

    let entity = getOrCreateAuction(event.params._auctionID, event);
    if (entity === null) {
        log.warning("auction with id {} not found", [
            event.params._auctionID.toString(),
        ]);
        return;
    }
    entity.endsAt = event.params._endTime;
    entity.cancellationPeriodDuration = BIGINT_CANCELLATION_PERIOD_IN_SECONDS;
    entity.save();
}

export function handleAuction_IncentivePaid(
    event: Auction_IncentivePaidEvent
): void {
    // emitter
    let emitter = getOrCreateUser(event.transaction.from);
    emitter.save();

    // event
    let ev = new Auction_IncentivePaid(events.id(event));
    ev.emitter = emitter.id;
    ev.transaction = transactions.log(event).id;
    ev.timestamp = event.block.timestamp;

    ev.auctionId = event.params._auctionID;
    ev.earner = event.params._earner;
    ev.incentiveAmount = event.params._incentiveAmount;

    // ev.auction = event.params._auctionID.toString();
    ev.save();

    // updated auction debt
    let auction = getOrCreateAuction(event.params._auctionID, event);
    if (auction === null) {
        log.warning("auction with id {} not found", [
            event.params._auctionID.toString(),
        ]);
        return;
    }
    auction.auctionDebt = auction.auctionDebt.plus(
        event.params._incentiveAmount
    );
    auction.save();
    let incentive = getOrCreateIncentive(
        auction,
        event.params._earner,
        event.params._incentiveAmount,
        event
    );
    incentive.save();

    // @todo: Payouts object: previousBidder

    let user = getOrCreateUser(event.params._earner);
    user.payouts = user.payouts.plus(BigInt.fromI32(1));
    user.payoutAmount = user.payoutAmount.plus(event.params._incentiveAmount);

    user.save();
    incentive.save();
}

export function handleAuction_Initialized(
    event: Auction_InitializedEvent
): void {
    // emitter
    let emitter = getOrCreateUser(event.transaction.from);

    // event
    let ev = new Auction_Initialized(events.id(event));
    ev.emitter = emitter.id;
    ev.transaction = transactions.log(event).id;
    ev.timestamp = event.block.timestamp;

    ev.auctionId = event.params._auctionID;
    ev.contractAddress = event.params._contractAddress;
    ev.presetID = event.params._presetID;
    ev.tokenAmount = event.params._tokenAmount;
    ev.tokenID = event.params._tokenID;
    ev.tokenKind = event.params._tokenKind;

    // ev.auction = event.params._auctionID.toString();
    ev.save();

    //Update statistics
    let statistics = Statistic.load("0");
    if (statistics == null) {
        statistics = new Statistic("0");
        statistics.erc721Auctions = BigInt.fromI32(0);
        statistics.erc1155Auctions = BigInt.fromI32(0);
        statistics.totalBidsVolume = BIGINT_ZERO;
        statistics.totalSalesVolume = BIGINT_ZERO;
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

    let auction = getOrCreateAuction(event.params._auctionID, event);

    // auction does not exist on chain
    if (!auction) {
        return;
    }

    auction.orderId = orderId;
    auction.type = type;
    auction.contractAddress = event.params._contractAddress;
    auction.tokenId = event.params._tokenID;
    auction.presetId = event.params._presetID.toI32();
    auction.totalBids = BigInt.fromI32(0);
    auction.claimed = false;
    auction.lastBidTime = BigInt.fromI32(0);
    auction.highestBid = BigInt.fromI32(0);
    auction.highestBidder = Address.fromString(
        "0x0000000000000000000000000000000000000000"
    );
    auction.cancelled = false;
    auction.buyNowPrice = BigInt.fromI32(0);
    auction.startBidPrice = BigInt.fromI32(0);
    auction.startBidFeePercent = BIGINT_STARTING_BID_FEE_PERCENT;
    auction.isBought = false;

    // Update Auction
    auction = updateAuction(auction, event);

    let contract = ContractV1.bind(event.address)
    let resultHammerTime = contract.try_getAuctionHammerTimeDuration();
    if (!resultHammerTime.reverted) {
        auction.hammerTimeDuration = resultHammerTime.value;
    }

    // @todo: seller, createdAt, startsAt, endsAt, claimAt,
    //  contractId quantity, presetId, cancelled, ercType, bids objects

    auction.quantity = event.params._tokenAmount;
    auction.cancellationPeriodDuration = BIGINT_CANCELLATION_PERIOD_IN_SECONDS;

    auction = updateProceeds(auction);
    auction.save();

    let contractEntity = ContractEntity.load(
        event.params._contractAddress.toHexString()
    );
    if (contractEntity == null) {
        contractEntity = new ContractEntity(
            event.params._contractAddress.toHexString()
        );
        contractEntity.biddingAllowed = false;
    }

    contractEntity.save();
    emitter.totalAuctionsCreated = emitter.totalAuctionsCreated.plus(
        BIGINT_ONE
    );
    emitter.save();
}

export function handleAuction_StartTimeUpdated(
    event: Auction_StartTimeUpdatedEvent
): void {
    // emitter
    let emitter = getOrCreateUser(event.transaction.from);
    emitter.save();

    // event
    let ev = new Auction_StartTimeUpdated(events.id(event));
    ev.emitter = emitter.id;
    ev.transaction = transactions.log(event).id;
    ev.timestamp = event.block.timestamp;

    ev.auctionId = event.params._auctionID;

    ev.endTime = event.params._endTime;
    ev.startTime = event.params._startTime;

    // ev.auction = event.params._auctionID.toString();
    ev.save();

    // update entity
    let entity = getOrCreateAuction(event.params._auctionID, event);
    if (entity === null) {
        log.warning("auction with id {} not found", [
            event.params._auctionID.toString(),
        ]);
        return;
    }
    entity.startsAt = event.params._startTime;
    entity.endsAt = event.params._endTime;
    entity.endsAtOriginal = entity.endsAt;
    entity.save();
}

export function handleContract_BiddingAllowed(
    event: Contract_BiddingAllowedEvent
): void {
    // emitter
    let emitter = getOrCreateUser(event.transaction.from);
    emitter.save();

    // event
    let ev = new Contract_BiddingAllowed(events.id(event));
    ev.emitter = emitter.id;
    ev.transaction = transactions.log(event).id;
    ev.timestamp = event.block.timestamp;

    ev.contract = event.params._contract;
    ev.biddingAllowed = event.params._biddingAllowed;

    ev.save();

    // update entity
    let entity = ContractEntity.load(event.params._contract.toHexString());
    if (entity == null) {
        entity = new ContractEntity(event.params._contract.toHexString());
    }
    entity.biddingAllowed = event.params._biddingAllowed;
    entity.save();
}

export function handleAuction_ItemClaimed(
    event: Auction_ItemClaimedEvent
): void {
    // emitter
    let emitter = getOrCreateUser(event.transaction.from);
    emitter.save();

    // event
    let ev = new Auction_ItemClaimed(events.id(event));
    ev.emitter = emitter.id;
    ev.transaction = transactions.log(event).id;
    ev.timestamp = event.block.timestamp;

    ev.auctionId = event.params._auctionID;

    // ev.auction = event.params._auctionID.toString();
    ev.save();

    // update entity
    let auction = getOrCreateAuction(event.params._auctionID, event);
    if (auction === null) {
        log.warning("auction with id {} not found", [
            event.params._auctionID.toString(),
        ]);
        return;
    }
    auction.claimed = true;
    auction.claimAt = event.block.timestamp;

    let bid = getOrCreateBid(
        auction.highestBidder,
        auction.highestBid,
        auction as Auction,
        event
    );
    bid.claimed = true;

    let user = getOrCreateUser(auction.highestBidder);
    user.wins = user.wins.plus(BigInt.fromI32(1));
    user.save();

    // Update Stats
    let stats = Statistic.load("0")!;
    stats.totalSalesVolume = stats.totalSalesVolume.plus(auction.highestBid);
    stats.save();

    // update contract stats
    let cStats = getOrCreateStatistics(auction.contractAddress);
    cStats.totalSalesVolume = cStats.totalSalesVolume.plus(auction.highestBid);
    cStats.save();

    bid.save();
    auction.save();
}

export function handleAuctionCancelled(event: AuctionCancelledEvent): void {
    // emitter
    let emitter = getOrCreateUser(event.transaction.from);
    emitter.save();

    // event
    let ev = new AuctionCancelled(events.id(event));
    ev.emitter = emitter.id;
    ev.transaction = transactions.log(event).id;
    ev.timestamp = event.block.timestamp;

    ev.auctionId = event.params._auctionId;
    ev.tokenId = event.params._tokenId;

    // ev.auction = event.params._auctionId.toString();
    ev.save();

    // update entity
    let auction = getOrCreateAuction(event.params._auctionId, event);
    if (auction === null) {
        log.warning("auction with id {} not found", [
            event.params._auctionId.toString(),
        ]);
        return;
    }

    auction.cancellationTime = event.block.timestamp;
    auction.cancelled = true;
    auction.save();
}

export function handleContract_RoyaltyPaid(event: RoyaltyPaidEvent): void {
    // update fees
    let auction = getOrCreateAuction(event.params._auctionId, event);
    if (auction === null) {
        return;
    }
    auction.royaltyFees = auction.royaltyFees.plus(event.params._amount);
    auction = updateProceeds(auction);
    auction.save();
}

export function handleAuction_BuyItNowUpdated(
    event: Auction_BuyItNowUpdatedEvent
): void {
    // emitter
    let emitter = getOrCreateUser(event.transaction.from);
    emitter.save();

    // event
    let ev = new Auction_BuyItNowUpdated(events.id(event));
    ev.emitter = emitter.id;
    ev.transaction = transactions.log(event).id;
    ev.timestamp = event.block.timestamp;

    ev.auctionId = event.params._auctionId;
    ev.buyNowPrice = event.params._buyItNowPrice;
    ev.save();

    // update entity
    let entity = getOrCreateAuction(event.params._auctionId, event);
    if (entity === null) {
        log.warning("auction with id {} not found", [
            event.params._auctionId.toString(),
        ]);
        return;
    }
    entity.buyNowPrice = event.params._buyItNowPrice;
    entity.save();
}

export function handleAuction_StartingPriceUpdated(
    event: Auction_StartingPriceUpdatedEvent
): void {
    // emitter
    let emitter = getOrCreateUser(event.transaction.from);
    emitter.save();

    // event
    let ev = new Auction_StartingPriceUpdated(events.id(event));
    ev.emitter = emitter.id;
    ev.transaction = transactions.log(event).id;
    ev.timestamp = event.block.timestamp;

    ev.auctionId = event.params._auctionId;
    ev.startBidPrice = event.params._startPrice;
    ev.save();

    // update entity
    let entity = getOrCreateAuction(event.params._auctionId, event);
    if (entity === null) {
        log.warning("auction with id {} not found", [
            event.params._auctionId.toString(),
        ]);
        return;
    }
    entity.startBidPrice = event.params._startPrice;
    entity.save();
}

export function handleAuction_BoughtNow(
    event: Auction_BoughtNowEvent
): void {
    // emitter
    let emitter = getOrCreateUser(event.transaction.from);
    emitter.save();

    // event
    let ev = new Auction_BoughtNow(events.id(event));
    ev.emitter = emitter.id;
    ev.transaction = transactions.log(event).id;
    ev.timestamp = event.block.timestamp;

    ev.auctionId = event.params._auctionId;
    ev.save();

    // update entity
    let auction = getOrCreateAuction(event.params._auctionId, event);
    if (auction === null) {
        log.warning("auction with id {} not found", [
            event.params._auctionId.toString(),
        ]);
        return;
    }
    auction.claimed = true;
    auction.claimAt = event.block.timestamp;
    auction.isBought = true;

    let bid = getOrCreateBid(
        auction.highestBidder,
        auction.highestBid,
        auction as Auction,
        event
    );
    bid.outbid = true;

    let user = getOrCreateUser(auction.highestBidder);
    user.outbids = user.outbids.plus(BigInt.fromI32(1));
    user.save();

    // Update Stats
    let stats = Statistic.load("0")!;
    stats.totalSalesVolume = stats.totalSalesVolume.plus(auction.buyNowPrice);
    stats.save();

    // update contract stats
    let cStats = getOrCreateStatistics(auction.contractAddress);
    cStats.totalSalesVolume = cStats.totalSalesVolume.plus(auction.buyNowPrice);
    cStats.save();

    bid.save();
    auction.save();
}
