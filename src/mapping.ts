import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import {
    Contract,
    Auction_BidPlaced as Auction_BidPlacedEvent,
    Auction_BidRemoved as Auction_BidRemovedEvent,
    Auction_EndTimeUpdated as Auction_EndTimeUpdatedEvent,
    Auction_IncentivePaid as Auction_IncentivePaidEvent,
    Auction_Initialized as Auction_InitializedEvent,
    Auction_StartTimeUpdated as Auction_StartTimeUpdatedEvent,
    Contract_BiddingAllowed as Contract_BiddingAllowedEvent,
    Auction_ItemClaimed as Auction_ItemClaimedEvent,
    AuctionCancelled as AuctionCancelledEvent,
} from "../generated/Contract/Contract";
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
} from "../generated/schema";
import {
    calculateIncentives,
    getOrCreateAuction,
    getOrCreateBid,
    getOrCreateIncentive,
    getOrCreateUser,
    updateProceeds,
} from "./helper";
import { events, transactions } from "@amxx/graphprotocol-utils";
import {
    BIGINT_CANCELLATION_PERIOD_IN_SECONDS,
    BIGINT_ONE,
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
    if (!auction) {
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
    if (!auction) {
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
    if (!entity) {
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
    auction.auctionDebt = auction.auctionDebt.plus(
        event.params._incentiveAmount
    );
    auction.save();

    if (!auction) {
        log.warning("auction with id {} not found", [
            event.params._auctionID.toString(),
        ]);
        return;
    }
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

    if (auction == null) {
        auction = new Auction(event.params._auctionID.toString());
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

    //Fetch auction info from contract
    let contract = Contract.bind(event.address);

    let result = contract.try_getAuctionInfo(event.params._auctionID);
    let resultHammerTime = contract.try_getAuctionHammerTimeDuration();

    // @todo: seller, createdAt, startsAt, endsAt, claimAt,
    //  contractId quantity, presetId, cancelled, ercType, bids objects
    if (!result.reverted && !resultHammerTime.reverted) {
        let auctionInfo = result.value;

        auction.auctionDebt = auctionInfo.auctionDebt;
        auctionInfo.biddingAllowed;
        auction.claimed = auctionInfo.claimed;

        let presets = auctionInfo.presets;
        auction.bidDecimals = presets.bidDecimals;
        auction.bidMultiplier = presets.bidMultiplier;
        auction.hammerTimeDuration = resultHammerTime.value;
        auction.incMax = presets.incMax;
        auction.incMin = presets.incMin;
        auction.stepMin = presets.stepMin;
        auction.seller = auctionInfo.owner;
        auction.createdAt = event.block.timestamp;
        auction.quantity = event.params._tokenAmount;
        auction.startsAt = event.block.timestamp;
        auction.dueIncentives = auctionInfo.dueIncentives;

        auction.startsAt = auctionInfo.info.startTime;
        auction.endsAt = auctionInfo.info.endTime;
        auction.endsAtOriginal = auctionInfo.info.endTime;

        // auction.claimAt =
        auction.highestBidder = auctionInfo.highestBidder;
        auction.cancellationPeriodDuration = BIGINT_CANCELLATION_PERIOD_IN_SECONDS;

        auction = updateProceeds(auction);
    }

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
    if (!entity) {
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
    if (!auction) {
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
    if (!auction) {
        log.warning("auction with id {} not found", [
            event.params._auctionId.toString(),
        ]);
        return;
    }

    auction.cancellationTime = event.block.timestamp;
    auction.cancelled = true;
    auction.save();
}
