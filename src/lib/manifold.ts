// Install ethers: npm install ethers
import { ethers } from 'ethers';

const CONTRACT_ADDRESS = "0xc1b92e0cec5d665bc4ce09dd2330bf3b0e4ac8ec"; // Update with your contract
const ABI = [
  "function mint(address to, uint256 tokenId) public payable",
  "function claim(uint256 tokenId) public",
  "function balanceOf(address owner) view returns (uint256)",
];

export const claimRitualArtifact = async (_userId: string): Promise<void> => {
  if (!window.ethereum) {
    throw new Error("Please install MetaMask or a Web3 wallet to claim your artifact.");
  }

  try {
    // Request account access
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const userAddress = await signer.getAddress();

    // Ensure Polygon Mainnet (Chain ID 137)
    const network = await provider.getNetwork();
    if (network.chainId !== 137n) {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x89' }], // 137 in hex
      });
    }

    const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    
    // Token ID for R41NBOW NFT (Day 6 reward)
    const tokenId = 6; 

    // Check if already claimed
    const balance = await contract.balanceOf(userAddress);
    if (balance > 0n) {
      alert("You have already claimed your artifact.");
      return;
    }

    // Execute claim (free mint)
    const tx = await contract.claim(tokenId);
    alert("Minting your artifact... please wait.");
    await tx.wait();
    alert("Artifact claimed successfully!");

  } catch (error: any) {
    console.error("Manifold Claim Error:", error);
    if (error.code === 4001 || error.message?.includes('user rejected')) {
      alert("Transaction rejected.");
    } else {
      alert(`Error: ${error.message || "Failed to claim artifact"}`);
    }
    throw error;
  }
};