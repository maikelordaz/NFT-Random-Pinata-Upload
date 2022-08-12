const { network, ethers } = require("hardhat")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId

    const randomIpfsNft = await ethers.getContract("RandomIpfsNft", deployer)
    const mintFee = await randomIpfsNft.getMintFee()
    const mintTx = await randomIpfsNft.requestNft({ value: mintFee.toString() })
    const mintTxReceipt = await mintTx.wait(1)
    // Listen for response
    await new Promise(async (resolve, reject) => {
        setTimeout(() => reject("Timeout: 'NFTMinted' event did not fire"), 300000) // 5 minutes
        // setup listener
        randomIpfsNft.once("NFTminted", async () => {
            resolve()
        })
        if (chainId == 31337) {
            const requestId = mintTxReceipt.events[1].args.requestId.toString()
            const vrfCoordinator = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
            await vrfCoordinator.fulfillRandomWords(requestId, randomIpfsNft.address)
        }
    })
    console.log(`Random IPFS NFT index 0 token URI: ${await randomIpfsNft.getDogTokenUri(0)}`)
}

module.exports.tags = ["all", "mint"]
