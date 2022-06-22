import { BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { Auction_BidPlaced, Auction_BidRemoved } from "../generated/Contract/Contract";
import { Auction, Bid, User } from "../generated/schema";

export function getOrCreateBid(bidder: Bytes, bidAmount: BigInt, auction: Auction, event: ethereum.Event): Bid {
    let bidId = auction.id + "_" + bidder.toHexString() + "_" + bidAmount.toString();
    let bid = Bid.load(bidId);
    if(bid == null) {
        bid = new Bid(bidId);
        bid.bidder = bidder;
        bid.amount = bidAmount;
        bid.auctionID = BigInt.fromString(auction.id);
        bid.auction = auction.id;
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
    }

    return bid as Bid;
}

export function getOrCreateUser(address: Bytes): User {
    let user = User.load(address.toHexString());
    if (user == null) {
        user = new User(address.toHexString());
        user.bids = BigInt.fromI32(0);
        user.bidAmount = BigInt.fromI32(0);
        user.outbids = BigInt.fromI32(0);
        user.payouts = BigInt.fromI32(0);
        user.payoutAmount = BigInt.fromI32(0);
        user.wins = BigInt.fromI32(0);
    }

    return user as User;
}