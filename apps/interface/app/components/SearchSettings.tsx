"use client";

import { useState, useEffect, useRef } from "react";
import type { RerankerTier } from "@engram/search-core";

export interface SearchSettingsState {
	rerank: boolean;
	forceTier?: "auto" | RerankerTier;
	rerankDepth: number;
	latencyBudgetMs?: number;
}

interface SearchSettingsProps {
	settings: SearchSettingsState;
	onChange: (settings: SearchSettingsState) => void;
}

const TIER_OPTIONS = [
	{ value: "auto", label: "Auto", description: "Intelligent routing based on query" },
	{ value: "fast", label: "Fast", description: "MiniLM - Low latency (~20ms)" },
	{ value: "accurate", label: "Accurate", description: "BGE - High quality scoring" },
	{ value: "code", label: "Code", description: "Jina - Code-specialized" },
	{ value: "llm", label: "LLM", description: "Grok - Premium listwise reranking" },
] as const;

export function SearchSettings({ settings, onChange }: SearchSettingsProps) {
	const [isOpen, setIsOpen] = useState(false);
	const panelRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);

	// Close panel when clicking outside
	useEffect(() => {
		if (!isOpen) return;

		const handleClickOutside = (event: MouseEvent) => {
			if (
				panelRef.current &&
				buttonRef.current &&
				!panelRef.current.contains(event.target as Node) &&
				!buttonRef.current.contains(event.target as Node)
			) {
				setIsOpen(false);
			}
		};

		// Close on escape key
		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setIsOpen(false);
				buttonRef.current?.focus();
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		document.addEventListener("keydown", handleEscape);

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
			document.removeEventListener("keydown", handleEscape);
		};
	}, [isOpen]);

	const handleToggleRerank = () => {
		onChange({ ...settings, rerank: !settings.rerank });
	};

	const handleTierChange = (tier: "auto" | RerankerTier) => {
		onChange({
			...settings,
			forceTier: tier === "auto" ? undefined : tier,
		});
	};

	const handleDepthChange = (depth: number) => {
		onChange({ ...settings, rerankDepth: depth });
	};

	const handleLatencyChange = (latency: string) => {
		const value = latency.trim() === "" ? undefined : Number.parseInt(latency, 10);
		onChange({
			...settings,
			latencyBudgetMs: value && !Number.isNaN(value) ? value : undefined,
		});
	};

	const selectedTier = settings.forceTier || "auto";

	return (
		<div
			style={{
				position: "relative",
				zIndex: 20,
			}}
		>
			{/* Settings Toggle Button */}
			<button
				ref={buttonRef}
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				aria-expanded={isOpen}
				aria-haspopup="true"
				aria-label="Configure reranker settings"
				style={{
					display: "flex",
					alignItems: "center",
					gap: "8px",
					padding: "8px 12px",
					background: isOpen
						? "linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(0, 245, 212, 0.1))"
						: "rgba(15, 20, 30, 0.6)",
					backdropFilter: "blur(12px)",
					WebkitBackdropFilter: "blur(12px)",
					border: isOpen ? "1px solid rgba(251, 191, 36, 0.4)" : "1px solid rgba(71, 85, 105, 0.3)",
					borderRadius: "8px",
					color: isOpen ? "rgb(251, 191, 36)" : "rgb(148, 163, 184)",
					fontSize: "11px",
					fontFamily: "Orbitron, sans-serif",
					fontWeight: 600,
					letterSpacing: "0.05em",
					cursor: "pointer",
					transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
					boxShadow: isOpen
						? "0 4px 20px rgba(251, 191, 36, 0.15), inset 0 1px 0 rgba(251, 191, 36, 0.1)"
						: "0 2px 8px rgba(0, 0, 0, 0.2)",
				}}
				onMouseEnter={(e) => {
					if (!isOpen) {
						e.currentTarget.style.background = "rgba(15, 20, 30, 0.8)";
						e.currentTarget.style.borderColor = "rgba(71, 85, 105, 0.5)";
					}
				}}
				onMouseLeave={(e) => {
					if (!isOpen) {
						e.currentTarget.style.background = "rgba(15, 20, 30, 0.6)";
						e.currentTarget.style.borderColor = "rgba(71, 85, 105, 0.3)";
					}
				}}
			>
				{/* Gear Icon */}
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					style={{
						transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
						transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
					}}
				>
					<circle cx="12" cy="12" r="3" />
					<path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24" />
				</svg>
				<span>RERANKER SETTINGS</span>
			</button>

			{/* Settings Panel */}
			{isOpen && (
				<div
					ref={panelRef}
					role="dialog"
					aria-label="Reranker configuration panel"
					style={{
						position: "absolute",
						top: "calc(100% + 8px)",
						right: 0,
						minWidth: "320px",
						maxWidth: "380px",
						background:
							"linear-gradient(135deg, rgba(15, 20, 30, 0.95) 0%, rgba(8, 10, 15, 0.98) 100%)",
						backdropFilter: "blur(20px)",
						WebkitBackdropFilter: "blur(20px)",
						border: "1px solid rgba(251, 191, 36, 0.25)",
						borderRadius: "12px",
						padding: "16px",
						boxShadow: "0 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(251, 191, 36, 0.1)",
						animation: "settingsPanelSlideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
					}}
				>
					{/* Top accent line */}
					<div
						style={{
							position: "absolute",
							top: 0,
							left: "50%",
							transform: "translateX(-50%)",
							width: "60%",
							height: "1px",
							background:
								"linear-gradient(90deg, transparent, rgba(251, 191, 36, 0.5), transparent)",
						}}
					/>

					{/* Panel Header */}
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							marginBottom: "16px",
							paddingBottom: "12px",
							borderBottom: "1px solid rgba(71, 85, 105, 0.2)",
						}}
					>
						<span
							style={{
								fontSize: "10px",
								fontFamily: "Orbitron, sans-serif",
								fontWeight: 600,
								letterSpacing: "0.15em",
								color: "rgb(251, 191, 36)",
								textShadow: "0 0 8px rgba(251, 191, 36, 0.4)",
							}}
						>
							RERANKER CONFIG
						</span>
						<div
							style={{
								width: "4px",
								height: "4px",
								borderRadius: "50%",
								backgroundColor: settings.rerank ? "rgb(34, 197, 94)" : "rgb(71, 85, 105)",
								boxShadow: settings.rerank ? "0 0 8px rgba(34, 197, 94, 0.6)" : "none",
								transition: "all 0.3s ease",
							}}
						/>
					</div>

					{/* Settings Controls */}
					<div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
						{/* 1. Reranking Toggle */}
						<div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
							<label
								htmlFor="enable-reranking"
								style={{
									fontSize: "9px",
									fontFamily: "JetBrains Mono, monospace",
									fontWeight: 500,
									color: "rgb(148, 163, 184)",
									letterSpacing: "0.05em",
									textTransform: "uppercase",
								}}
							>
								Enable Reranking
							</label>
							<button
								id="enable-reranking"
								type="button"
								onClick={handleToggleRerank}
								aria-pressed={settings.rerank}
								aria-label={settings.rerank ? "Reranking enabled" : "Reranking disabled"}
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									padding: "10px 12px",
									background: settings.rerank ? "rgba(34, 197, 94, 0.1)" : "rgba(71, 85, 105, 0.1)",
									border: settings.rerank
										? "1px solid rgba(34, 197, 94, 0.3)"
										: "1px solid rgba(71, 85, 105, 0.2)",
									borderRadius: "8px",
									cursor: "pointer",
									transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
								}}
								onMouseEnter={(e) => {
									e.currentTarget.style.background = settings.rerank
										? "rgba(34, 197, 94, 0.15)"
										: "rgba(71, 85, 105, 0.15)";
									e.currentTarget.style.borderColor = settings.rerank
										? "rgba(34, 197, 94, 0.4)"
										: "rgba(71, 85, 105, 0.3)";
								}}
								onMouseLeave={(e) => {
									e.currentTarget.style.background = settings.rerank
										? "rgba(34, 197, 94, 0.1)"
										: "rgba(71, 85, 105, 0.1)";
									e.currentTarget.style.borderColor = settings.rerank
										? "rgba(34, 197, 94, 0.3)"
										: "rgba(71, 85, 105, 0.2)";
								}}
							>
								<span
									style={{
										fontSize: "11px",
										fontFamily: "JetBrains Mono, monospace",
										color: settings.rerank ? "rgb(34, 197, 94)" : "rgb(100, 116, 139)",
										fontWeight: 500,
									}}
								>
									{settings.rerank ? "Enabled" : "Disabled"}
								</span>
								<div
									style={{
										width: "40px",
										height: "20px",
										background: settings.rerank
											? "rgba(34, 197, 94, 0.3)"
											: "rgba(71, 85, 105, 0.3)",
										borderRadius: "10px",
										position: "relative",
										transition: "background 0.2s ease",
									}}
								>
									<div
										style={{
											position: "absolute",
											top: "2px",
											left: settings.rerank ? "22px" : "2px",
											width: "16px",
											height: "16px",
											background: settings.rerank ? "rgb(34, 197, 94)" : "rgb(100, 116, 139)",
											borderRadius: "50%",
											transition: "left 0.25s cubic-bezier(0.4, 0, 0.2, 1), background 0.25s ease",
											boxShadow: settings.rerank ? "0 0 8px rgba(34, 197, 94, 0.6)" : "none",
										}}
									/>
								</div>
							</button>
						</div>

						{/* 2. Tier Selection */}
						<div
							style={{
								display: "flex",
								flexDirection: "column",
								gap: "6px",
								opacity: settings.rerank ? 1 : 0.4,
								pointerEvents: settings.rerank ? "auto" : "none",
								transition: "opacity 0.3s ease",
							}}
						>
							<label
								id="tier-selection-label"
								style={{
									fontSize: "9px",
									fontFamily: "JetBrains Mono, monospace",
									fontWeight: 500,
									color: "rgb(148, 163, 184)",
									letterSpacing: "0.05em",
									textTransform: "uppercase",
								}}
							>
								Reranker Tier
							</label>
							<div
								role="radiogroup"
								aria-labelledby="tier-selection-label"
								style={{ display: "flex", flexDirection: "column", gap: "4px" }}
							>
								{TIER_OPTIONS.map((option) => (
									<button
										key={option.value}
										type="button"
										role="radio"
										aria-checked={selectedTier === option.value}
										onClick={() => handleTierChange(option.value as "auto" | RerankerTier)}
										disabled={!settings.rerank}
										style={{
											display: "flex",
											flexDirection: "column",
											alignItems: "flex-start",
											padding: "8px 10px",
											background:
												selectedTier === option.value
													? "rgba(251, 191, 36, 0.12)"
													: "rgba(22, 30, 45, 0.4)",
											border:
												selectedTier === option.value
													? "1px solid rgba(251, 191, 36, 0.3)"
													: "1px solid rgba(71, 85, 105, 0.15)",
											borderRadius: "6px",
											cursor: settings.rerank ? "pointer" : "not-allowed",
											transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
											textAlign: "left",
										}}
										onMouseEnter={(e) => {
											if (settings.rerank && selectedTier !== option.value) {
												e.currentTarget.style.background = "rgba(22, 30, 45, 0.6)";
												e.currentTarget.style.borderColor = "rgba(71, 85, 105, 0.25)";
											}
										}}
										onMouseLeave={(e) => {
											if (settings.rerank && selectedTier !== option.value) {
												e.currentTarget.style.background = "rgba(22, 30, 45, 0.4)";
												e.currentTarget.style.borderColor = "rgba(71, 85, 105, 0.15)";
											}
										}}
									>
										<div
											style={{
												display: "flex",
												alignItems: "center",
												gap: "6px",
												width: "100%",
											}}
										>
											<div
												style={{
													width: "6px",
													height: "6px",
													borderRadius: "50%",
													background:
														selectedTier === option.value
															? "rgb(251, 191, 36)"
															: "rgb(71, 85, 105)",
													boxShadow:
														selectedTier === option.value
															? "0 0 8px rgba(251, 191, 36, 0.6)"
															: "none",
													transition: "all 0.2s ease",
												}}
											/>
											<span
												style={{
													fontSize: "11px",
													fontFamily: "Orbitron, sans-serif",
													fontWeight: 600,
													letterSpacing: "0.05em",
													color:
														selectedTier === option.value
															? "rgb(251, 191, 36)"
															: "rgb(148, 163, 184)",
													transition: "color 0.2s ease",
												}}
											>
												{option.label}
											</span>
										</div>
										<span
											style={{
												fontSize: "9px",
												fontFamily: "JetBrains Mono, monospace",
												color: "rgb(100, 116, 139)",
												marginTop: "2px",
												marginLeft: "12px",
											}}
										>
											{option.description}
										</span>
									</button>
								))}
							</div>
						</div>

						{/* 3. Rerank Depth */}
						<div
							style={{
								display: "flex",
								flexDirection: "column",
								gap: "6px",
								opacity: settings.rerank ? 1 : 0.4,
								pointerEvents: settings.rerank ? "auto" : "none",
								transition: "opacity 0.3s ease",
							}}
						>
							<label
								htmlFor="rerank-depth"
								style={{
									fontSize: "9px",
									fontFamily: "JetBrains Mono, monospace",
									fontWeight: 500,
									color: "rgb(148, 163, 184)",
									letterSpacing: "0.05em",
									textTransform: "uppercase",
								}}
							>
								Rerank Depth ({settings.rerankDepth})
							</label>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: "10px",
								}}
							>
								<input
									id="rerank-depth"
									type="range"
									min="10"
									max="100"
									step="10"
									value={settings.rerankDepth}
									onChange={(e) => handleDepthChange(Number.parseInt(e.target.value, 10))}
									disabled={!settings.rerank}
									aria-label={`Rerank depth: ${settings.rerankDepth} results`}
									aria-valuemin={10}
									aria-valuemax={100}
									aria-valuenow={settings.rerankDepth}
									style={{
										flex: 1,
										height: "4px",
										background: `linear-gradient(to right,
											rgba(251, 191, 36, 0.4) 0%,
											rgba(251, 191, 36, 0.4) ${((settings.rerankDepth - 10) / 90) * 100}%,
											rgba(71, 85, 105, 0.3) ${((settings.rerankDepth - 10) / 90) * 100}%,
											rgba(71, 85, 105, 0.3) 100%)`,
										borderRadius: "2px",
										outline: "none",
										appearance: "none",
										cursor: settings.rerank ? "pointer" : "not-allowed",
									}}
								/>
								<span
									style={{
										fontSize: "11px",
										fontFamily: "JetBrains Mono, monospace",
										color: "rgb(251, 191, 36)",
										minWidth: "32px",
										textAlign: "right",
										fontWeight: 600,
									}}
								>
									{settings.rerankDepth}
								</span>
							</div>
						</div>

						{/* 4. Latency Budget (Optional) */}
						<div
							style={{
								display: "flex",
								flexDirection: "column",
								gap: "6px",
								opacity: settings.rerank ? 1 : 0.4,
								pointerEvents: settings.rerank ? "auto" : "none",
								transition: "opacity 0.3s ease",
							}}
						>
							<label
								htmlFor="latency-budget"
								style={{
									fontSize: "9px",
									fontFamily: "JetBrains Mono, monospace",
									fontWeight: 500,
									color: "rgb(148, 163, 184)",
									letterSpacing: "0.05em",
									textTransform: "uppercase",
									display: "flex",
									alignItems: "center",
									gap: "4px",
								}}
							>
								Latency Budget (ms)
								<span
									style={{
										fontSize: "8px",
										color: "rgb(71, 85, 105)",
										fontStyle: "italic",
									}}
								>
									- optional
								</span>
							</label>
							<input
								id="latency-budget"
								type="number"
								placeholder="Auto"
								value={settings.latencyBudgetMs ?? ""}
								onChange={(e) => handleLatencyChange(e.target.value)}
								disabled={!settings.rerank}
								min="10"
								max="5000"
								step="10"
								aria-label="Latency budget in milliseconds"
								style={{
									padding: "8px 10px",
									background: "rgba(22, 30, 45, 0.6)",
									border: "1px solid rgba(71, 85, 105, 0.3)",
									borderRadius: "6px",
									color: "rgb(226, 232, 240)",
									fontSize: "11px",
									fontFamily: "JetBrains Mono, monospace",
									outline: "none",
									transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
									cursor: settings.rerank ? "text" : "not-allowed",
								}}
								onFocus={(e) => {
									if (settings.rerank) {
										e.target.style.borderColor = "rgba(251, 191, 36, 0.5)";
										e.target.style.boxShadow = "0 0 12px rgba(251, 191, 36, 0.15)";
										e.target.style.background = "rgba(22, 30, 45, 0.8)";
									}
								}}
								onBlur={(e) => {
									e.target.style.borderColor = "rgba(71, 85, 105, 0.3)";
									e.target.style.boxShadow = "none";
									e.target.style.background = "rgba(22, 30, 45, 0.6)";
								}}
							/>
						</div>
					</div>

					{/* Info Footer */}
					<div
						style={{
							marginTop: "12px",
							paddingTop: "12px",
							borderTop: "1px solid rgba(71, 85, 105, 0.2)",
							fontSize: "8px",
							fontFamily: "JetBrains Mono, monospace",
							color: "rgb(71, 85, 105)",
							lineHeight: 1.4,
						}}
					>
						Settings apply to the next search query. LLM tier requires explicit selection.
					</div>
				</div>
			)}

			{/* Animations */}
			<style jsx>{`
				@keyframes settingsPanelSlideIn {
					from {
						opacity: 0;
						transform: translateY(-8px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}

				/* Range input styling */
				input[type="range"]::-webkit-slider-thumb {
					appearance: none;
					width: 14px;
					height: 14px;
					border-radius: 50%;
					background: rgb(251, 191, 36);
					cursor: pointer;
					box-shadow: 0 0 8px rgba(251, 191, 36, 0.6);
					transition: all 0.2s ease;
				}

				input[type="range"]::-webkit-slider-thumb:hover {
					transform: scale(1.1);
					box-shadow: 0 0 12px rgba(251, 191, 36, 0.8);
				}

				input[type="range"]::-moz-range-thumb {
					width: 14px;
					height: 14px;
					border: none;
					border-radius: 50%;
					background: rgb(251, 191, 36);
					cursor: pointer;
					box-shadow: 0 0 8px rgba(251, 191, 36, 0.6);
					transition: all 0.2s ease;
				}

				input[type="range"]::-moz-range-thumb:hover {
					transform: scale(1.1);
					box-shadow: 0 0 12px rgba(251, 191, 36, 0.8);
				}

				/* Number input styling */
				input[type="number"]::-webkit-inner-spin-button,
				input[type="number"]::-webkit-outer-spin-button {
					opacity: 1;
				}
			`}</style>
		</div>
	);
}
