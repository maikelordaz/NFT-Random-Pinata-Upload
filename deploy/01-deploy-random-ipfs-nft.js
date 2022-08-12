const { ethers, network } = require("hardhat")
const { verify } = require("../utils/verify")
const { storeImages, storeTokenUriMetadata } = require("../utils/uploadToPinata")
const {
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
    networkConfig,
    FUND_AMOUNT,
} = require("../helper-hardhat-config")

const imagesLocation = "./images/randomNft"
/*
* Puedo simplemente colocarlo asi o automatizar la subida a piñata que es lo que hago en este 
* script. Luego de hecho el deploy en consola voy a obtener los CID, podria tomarlos y cambiar
* let tokenUris 
* por
* let tokenUris = 
[
    "ipfs://QmaVkBn2tKmjbhphU7eyztbvSQU5EXDdqRyXZtRhSGgJGo",
    "ipfs://QmYQC5aGZu2PTH8XzbJrbDnvhj3gVs7ya33H9mqUNvST3d",
    "ipfs://QmZYmH5iDbD6v3U2ixoVAjioSzvWJszDzYdbeCLquGSpVm",
]
* Luego de eso voy a mi archivo .env y cambio el UPLOAD_TO_PINATA a false, de esta forma no
* entra en el if que ejecuta la funcion que se llama handleTokenUris(), que es la que sube 
* las imagenes y la metadata a Pinata, al tener que subirlo a Pinata tarda en hacerlo, y ni 
* Pinata ni IPFS acepta duplicados así que el CID va a seguir siendo el mismo. La función solo
* se tiene que ejecutar una vez. Una vez lo haga tomo los CID los añado a mi propio nodo de 
* IPFS y lo pineo ahi, así los tengo en mi nodo local y en el servidor de Pinata
*/
let tokenUris
/*
 * Con plantillas de este estilo es que añado cualquier tipo de caracteristica a mis NFT
 * Si estos atributos se guardan on chain mi contrato puede interatuar con ellos
 */
const metadataTemplate = {
    name: "",
    description: "",
    image: "",
    attributes: [
        {
            trait_type: "Cuteness",
            value: 100,
        },
    ],
}

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoordinatorV2Address, subscriptionId

    if (process.env.UPLOAD_TO_PINATA == "true") {
        tokenUris = await handleTokenUris()
    }

    if (chainId == 31337) {
        const vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock")
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address
        const txResponse = await vrfCoordinatorV2Mock.createSubscription()
        const txReceipt = await txResponse.wait(1)
        subscriptionId = txReceipt.events[0].args.subId
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId].vrfCoordinatorV2
        subscriptionId = networkConfig[chainId].subscriptionId
    }

    log("--------------- Deploying Random IPFS NFT Contract... ---------------")

    const waitBlockConfirmations = developmentChains.includes(network.name)
        ? 1
        : VERIFICATION_BLOCK_CONFIRMATIONS

    const args = [
        vrfCoordinatorV2Address,
        networkConfig[chainId]["gasLane"],
        subscriptionId,
        networkConfig[chainId]["callbackGasLimit"],
        networkConfig[chainId]["mintFee"],
        tokenUris,
    ]

    const randomIpfsNft = await deploy("RandomIpfsNft", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: waitBlockConfirmations,
    })
    log("--------------- Random IPFS NFT Contract Deployed! ---------------")

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("--------------- Verifying!... --------------- ")
        await verify(randomIpfsNft.address, args)
        log("--------------- Veryfy process finished! ---------------")
    }
}

async function handleTokenUris() {
    tokenUris = []
    /*
     * Este const de abajo me va a dar una lista de respuestas desde piñata, luego hago un loop
     * con el for por cada una de esas respuestas
     */
    const { responses: imageUploadResponses, files } = await storeImages(imagesLocation)
    for (imageUploadResponseIndex in imageUploadResponses) {
        let tokenUriMetadata = { ...metadataTemplate }
        tokenUriMetadata.name = files[imageUploadResponseIndex].replace(".png", "")
        tokenUriMetadata.description = `An adorable ${tokenUriMetadata.name} pup!`
        tokenUriMetadata.image = `ipfs://${imageUploadResponses[imageUploadResponseIndex].IpfsHash}`
        console.log(`Uploading ${tokenUriMetadata.name}...`)
        const metadataUploadResponse = await storeTokenUriMetadata(tokenUriMetadata)
        tokenUris.push(`ipfs://${metadataUploadResponse.IpfsHash}`)
    }
    console.log("Token URIs uploaded! They are:")
    console.log(tokenUris)
    return tokenUris
}

module.exports.tags = ["all", "randomipfs", "main"]
