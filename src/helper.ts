import {
    Address,
    bigInt,
    BigInt,
    Bytes,
    ethereum,
} from "@graphprotocol/graph-ts";
import {
    Auction_BidPlaced,
    Auction_BidRemoved,
    Contract,
} from "../generated/Contract/Contract";
import { Auction, Bid, Incentive, Statistic, User } from "../generated/schema";
import { BIGINT_ONE, BIGINT_ZERO } from "./constants";

export function getOrCreateBid(
    bidder: Bytes,
    bidAmount: BigInt,
    auction: Auction,
    event: ethereum.Event
): Bid {
    let bidId =
        auction.id + "_" + bidder.toHexString() + "_" + bidAmount.toString();
    let bid = Bid.load(bidId);
    if (bid == null) {
        bid = new Bid(bidId);
        bid.bidder = bidder;
        bid.amount = bidAmount;
        bid.auctionID = BigInt.fromString(auction.id);
        // bid.auction = auction.id;
        bid.outbid = false;
        bid.bidTime = event.block.timestamp;
        bid.claimed = false;

        //Set the previous bid / bidder
        bid.previousBid = auction.highestBid;
        bid.previousBidder = auction.highestBidder;

        //Get tokenId and tokenIndex
        bid.tokenId = auction.tokenId;
        bid.contractAddress = auction.contractAddress;
        bid.type = auction.type;

        //Get remaining auction time
        bid.auctionTimeLeft = auction.endsAt!.minus(event.block.timestamp);
        bid.auctionOrderId = auction.orderId;
        bid.auctionEndTime = auction.endsAt;

        bid.bidMultiplier = auction.bidMultiplier;
        bid.auctionCreatedAt = auction.createdAt!;
        bid.presetId = auction.presetId;
    }

    return bid as Bid;
}

export function getOrCreateUser(address: Bytes): User {
    let user = User.load(address);
    if (user == null) {
        user = new User(address);
        user.bids = BigInt.fromI32(0);
        user.bidAmount = BigInt.fromI32(0);
        user.outbids = BigInt.fromI32(0);
        user.payouts = BigInt.fromI32(0);
        user.payoutAmount = BigInt.fromI32(0);
        user.wins = BigInt.fromI32(0);
        user.totalAuctionsCreated = BigInt.fromI32(0);
    }

    return user as User;
}

export function getOrCreateAuction(
    auctionId: BigInt,
    event: ethereum.Event
): Auction | null {
    let id = auctionId.toString();
    let auction = Auction.load(id);
    if (!auction) {
        auction = new Auction(id);
        let contract = Contract.bind(event.address);
        let result = contract.try_getAuctionInfo(auctionId);
        if (result.reverted) {
            return null;
        }

        let value = result.value;
        auction.bidDecimals = value.presets.bidDecimals;
        auction.bidMultiplier = value.presets.bidMultiplier;
        // auction.bids = [];
        auction.cancelled = false;
        auction.claimed = value.claimed;
        auction.claimAt = BIGINT_ZERO;
        auction.contractAddress = event.address;
        auction.totalBidsVolume = BIGINT_ZERO;
        auction.royaltyFees = BIGINT_ZERO;
        auction.totalBids = BIGINT_ZERO;
        auction.buyNowPrice = BIGINT_ZERO;
        auction.startBidPrice = BIGINT_ZERO;
    }

    return auction;

    // id: ID! #generated auction ID
    // orderId: BigInt!
    // type: String! #erc1155 or erc721
    // tokenId: BigInt!
    // contractAddress: Bytes! #the contract address
    // highestBid: BigInt! #highest bid
    // highestBidder: Bytes! #highest bidder
    // lastBidTime: BigInt!
    // totalBids: BigInt!
    // claimed: Boolean!
}

export function getOrCreateIncentive(
    auction: Auction,
    earner: Address,
    amount: BigInt,
    event: ethereum.Event
): Incentive {
    let incentiveId =
        auction.id + "_" + earner.toHexString() + "_" + amount.toString();

    let incentive = Incentive.load(incentiveId);

    if (incentive == null) {
        incentive = new Incentive(incentiveId);
        incentive.amount = amount;
        incentive.earner = earner;
        incentive.auctionID = bigInt.fromString(auction.id);
        // incentive.auction = auction.id;
        incentive.tokenId = auction.tokenId;
        incentive.contractAddress = auction.contractAddress;
        incentive.type = auction.type;
        incentive.auctionOrderId = auction.orderId;
        incentive.receiveTime = event.block.timestamp;

        incentive.bidMultiplier = auction.bidMultiplier;
        incentive.auctionCreatedAt = auction.createdAt!;
        incentive.presetId = auction.presetId;
    }

    return incentive;
}

/// @notice Calculating and setting how much payout a bidder will receive if outbid
/// @dev Only callable internally
export function calculateIncentives(
    auction: Auction,
    _newBidValue: BigInt
): BigInt {
    const bidDecimals = auction.bidDecimals;
    const bidIncMax = auction.incMax;

    //Init the baseline bid we need to perform against
    let baseBid = auction.highestBid
        .times(bidDecimals.plus(auction.stepMin))
        .div(bidDecimals);

    //If no bids are present, set a basebid value of 1 to prevent divide by 0 errors
    if (baseBid.equals(BIGINT_ZERO)) {
        baseBid = BIGINT_ONE;
    }

    //Ratio of newBid compared to expected minBid
    let decimaledRatio = bidDecimals
        .times(auction.bidMultiplier)
        .times(_newBidValue.minus(baseBid))
        .div(baseBid.plus(auction.incMin).times(bidDecimals));

    if (decimaledRatio.gt(bidDecimals.times(bidIncMax))) {
        decimaledRatio = bidDecimals.times(bidIncMax);
    }

    return _newBidValue
        .times(decimaledRatio)
        .div(bidDecimals.times(bidDecimals));
}

export function updateProceeds(auction: Auction): Auction {
    const proceeds = auction.highestBid;

    // 0,5%
    const zeroFivePct = proceeds.div(BigInt.fromI32(200));

    // 1% to gbm
    const gbmShare = zeroFivePct.times(BigInt.fromI32(2));
    // 0,5% to pixelcraft
    const pixelcraftShare = zeroFivePct.times(BIGINT_ONE);
    // 1,5% to dao
    const daoShare = zeroFivePct.times(BigInt.fromI32(3));
    // 1% to treasury
    const treasuryShare = zeroFivePct.times(BigInt.fromI32(2));

    auction.platformFees = pixelcraftShare.plus(daoShare).plus(treasuryShare);
    auction.gbmFees = gbmShare;
    auction.sellerProceeds = proceeds
        .minus(auction.auctionDebt)
        .minus(auction.platformFees)
        .minus(auction.gbmFees)
        .minus(auction.royaltyFees);

    return auction;
}

export function getOrCreateStatistics(contractAddress: Bytes): Statistic {
    let stats = Statistic.load(contractAddress.toHexString());
    if (!stats) {
        stats = new Statistic(contractAddress.toHexString());
        stats.erc1155Auctions = BIGINT_ZERO;
        stats.erc721Auctions = BIGINT_ZERO;
        stats.totalBidsVolume = BIGINT_ZERO;
        stats.totalSalesVolume = BIGINT_ZERO;
    }

    return stats;
}
