const { network } = require("hardhat")
const { DECIMALS, INITIAL_PRICE, BASE_FEE, GAS_PRICE_LINK } = require("../helper-hardhat-config")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    if (chainId == 31337) {
        log("--------------- Local network detected! ---------------")
        log("--------------- Deploying VRF Cordinator V2 Mock ---------------")
        const VRFConstructorArgs = [BASE_FEE, GAS_PRICE_LINK]
        await deploy("VRFCoordinatorV2Mock", {
            from: deployer,
            log: true,
            args: VRFConstructorArgs,
        })
        log("--------------- VRF Cordinator V2 Mock deployed! ---------------")
        log("--------------- Mocks deployed! ---------------")
    }
}

module.exports.tags = ["all", "mocks", "main"]
