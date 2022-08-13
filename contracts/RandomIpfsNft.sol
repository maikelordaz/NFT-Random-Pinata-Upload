// SPDX-License-Identifier: MIT

/*
 * Cuando minteamos un NFT hacemos la llamada al Chainlink VRF por un numero al azar
 * Con ese numero obtenemos un NFT al azar
 * Pug, Shiba, San Bernardo
 * Pug -> Super raro
 * Shiba -> Raro
 * San Benardo -> Comun
 * Hay que pagar para mintear
 * El dueño del contrato puede retirar el dinero recogido por mintear
 */
pragma solidity ^0.8.8;

// IMPORTS CONTRACTS

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// IMPORTS INTERFACES

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";

// ERRORS

error RandomIpfsNft__OutOfBounds();
error RandomIpfsNft__NeedMoreEth();
error RandomIpfsNft__TransferFailed();

// CONTRACT

contract RandomIpfsNft is VRFConsumerBaseV2, ERC721URIStorage, Ownable {
    // TYPE DECLARATIONS
    enum Breed {
        PUG,
        SHIBA_INU,
        ST_BERNARD
    }
    // CHAINLINK VRF VARIABLES

    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subscriptionId;
    uint32 private immutable i_callbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    // NFT VARIABLES
    uint256 private s_tokenCounter;
    uint256 internal constant MAX_CHANCE = 100;
    uint256 private immutable i_mintFee;
    string[] internal s_dogTokenUri;

    // MAPPINGS

    mapping(uint256 => address) public s_requestIdToSender;

    // EVENTS

    event NFTrequested(uint256 indexed reuestId, address requester);
    event NFTminted(Breed breed, address minter);

    // CONSTRUCTOR

    constructor(
        address vrfCoordinatorV2,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit,
        uint256 mintFee,
        string[3] memory dogTokenUri
    ) VRFConsumerBaseV2(vrfCoordinatorV2) ERC721("Random IPFS NFT", "RIN") {
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane; // KeyHash
        i_subscriptionId = subscriptionId;
        i_callbackGasLimit = callbackGasLimit;
        i_mintFee = mintFee;
        s_dogTokenUri = dogTokenUri;
    }

    // FUNCTIONS

    function requestNft() public payable returns (uint256 requestId) {
        if (msg.value < i_mintFee) {
            revert RandomIpfsNft__NeedMoreEth();
        }
        requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subscriptionId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );
        s_requestIdToSender[requestId] = msg.sender;
        emit NFTrequested(requestId, msg.sender);
    }

    function fulfillRandomWords(uint256 requestId, uint256[] memory randomWords) internal override {
        address dogOwner = s_requestIdToSender[requestId];
        uint256 newItemId = s_tokenCounter;
        s_tokenCounter++;
        uint256 modded = randomWords[0] % MAX_CHANCE;
        Breed dogBreed = getBreedFromModded(modded);
        _safeMint(dogOwner, newItemId);
        _setTokenURI(newItemId, s_dogTokenUri[uint256(dogBreed)]);
        emit NFTminted(dogBreed, dogOwner);
    }

    function withdraw() public onlyOwner {
        uint256 amount = address(this).balance;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) {
            revert RandomIpfsNft__TransferFailed();
        }
    }

    // PURE - VIEW FUNCTIONS

    function getBreedFromModded(uint256 modded) public pure returns (Breed) {
        uint256 cumulative = 0;
        uint256[3] memory chanceArray = getChanceArray();
        for (uint256 i = 0; i < chanceArray.length; i++) {
            if (modded >= cumulative && modded < cumulative + chanceArray[i]) {
                return Breed(i);
            }
            cumulative += chanceArray[i];
        }
        revert RandomIpfsNft__OutOfBounds();
    }

    function getTokenCounter() public view returns (uint256) {
        return s_tokenCounter;
    }

    function getChanceArray() public pure returns (uint256[3] memory) {
        return [10, 30, MAX_CHANCE];
    }

    function getMintFee() public view returns (uint256) {
        return i_mintFee;
    }

    function getDogTokenUri(uint256 index) public view returns (string memory) {
        return s_dogTokenUri[index];
    }

}
