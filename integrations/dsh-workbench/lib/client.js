window.__ModuleLoader__.load({
	id: "@relay/dsh-plugin-workbench",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_runtime_client = require("@deepseek-ai/dsh-client-runtime/client");
		/** Viewport width below which the sidebar auto-collapses to the rail (deepsuite
		* LG breakpoint); a manual toggle below it re-expands over the squeezed center
		* (stores.ts narrowExpanded). */
		const SIDEBAR_AUTO_COLLAPSE = 1024;
		/** Side workbench panel ceiling for wide desktop layouts. */
		const SIDE_PANEL_MAX = 1120;
		/**
		* Clamp a panel width into its contract range.
		* @param px - requested width.
		* @param min - range lower bound.
		* @param max - range upper bound.
		* @returns the clamped width.
		*/
		function clampWidth(px, min, max) {
			return Math.min(max, Math.max(min, Math.round(px)));
		}
		/**
		* Solve the three column widths for one viewport frame. Pure: no hysteresis —
		* the output is a function of (viewport, preferences) only, so recovery on
		* re-widening is automatic. Preferences re-clamp here because they cross the
		* store boundary and callers may still supply stale ranges.
		* @param viewport - available frame width in px.
		* @param sidebar - sidebar width preference in px (0 = closed).
		* @param details - details width preference in px (0 = closed).
		* @returns resolved widths; details 0 means visually closed (never unmounted), while a closed sidebar keeps its compact rail.
		*/
		function computeColumns(viewport, sidebar, details, range = {
			min: 300,
			max: 520
		}) {
			const s = sidebar === 0 ? 56 : clampWidth(sidebar, 264, 420);
			const d0 = details === 0 ? 0 : clampWidth(details, range.min, range.max);
			if (s + d0 + 640 <= viewport) return {
				sidebar: s,
				center: viewport - s - d0,
				details: d0
			};
			const d1 = d0 === 0 ? 0 : Math.max(range.min, viewport - s - 640);
			if (s + d1 + 640 <= viewport) return {
				sidebar: s,
				center: 640,
				details: d1
			};
			if (range.preserveMinimum === true && d0 > 0) {
				const preserved = Math.min(range.min, Math.max(0, viewport - s));
				return {
					sidebar: s,
					center: Math.max(0, viewport - s - preserved),
					details: preserved
				};
			}
			return {
				sidebar: s,
				center: Math.max(0, viewport - s),
				details: 0
			};
		}
		//#endregion
		//#region \0relay-css-module:./src/client/layout/AppFrame.module.css.mjs
		const css = ".pBeByW_frame{background:var(--dsw-alias-bg-base);height:100%;transition:grid-template-columns var(--ds-transition-duration-slow) var(--ds-ease-in-out);grid-template-rows:100%;display:grid;position:relative;overflow:hidden}.pBeByW_frame[data-dragging]{transition:none}@media (prefers-reduced-motion:reduce){.pBeByW_frame{transition:none}}.pBeByW_sidebarCol{background:var(--dsw-specific-sidebar-fill);border-right:1px solid var(--dsw-alias-border-l1);min-width:0;overflow:hidden}.pBeByW_centerCol{flex-direction:column;min-width:0;display:flex;overflow:hidden}.pBeByW_centerStack{min-width:0;min-height:0;transition:grid-template-rows var(--ds-transition-duration-slow) var(--ds-ease-in-out);display:grid;position:relative;overflow:hidden}.pBeByW_frame[data-dragging] .pBeByW_centerStack{transition:none}.pBeByW_bottomCol{border-top:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);min-width:0;min-height:0;overflow:hidden}.pBeByW_frame[data-bottom-collapsed] .pBeByW_bottomCol{border-top:none}.pBeByW_rightCol{border-left:1px solid var(--dsw-alias-border-l2);min-width:0;position:relative;overflow:hidden}.pBeByW_rightSurface{visibility:hidden;pointer-events:none;position:absolute;inset:0;overflow:hidden}.pBeByW_rightSurface[data-active]{visibility:visible;pointer-events:auto}.pBeByW_auxiliary{background:var(--dsw-alias-bg-base);grid-template-rows:46px minmax(0,1fr);width:100%;min-width:0;height:100%;min-height:0;display:grid;position:relative;overflow:hidden}.pBeByW_auxiliaryTabs{border-bottom:1px solid var(--dsw-alias-border-l2);align-items:center;gap:5px;min-width:0;padding:0 10px;display:flex;position:relative}.pBeByW_auxiliaryTabList{scrollbar-width:none;align-items:center;gap:5px;min-width:0;max-width:calc(100% - 86px);display:flex;overflow:auto hidden}.pBeByW_auxiliaryTabList::-webkit-scrollbar{display:none}.pBeByW_auxiliaryTabList button,.pBeByW_auxiliaryMenu button{min-width:0;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;align-items:center;gap:6px;display:inline-flex}.pBeByW_auxiliaryTabList button{white-space:nowrap;border-bottom:2px solid #0000;height:40px;padding:0 8px}.pBeByW_auxiliaryTabList button[data-active]{border-bottom-color:var(--dsw-alias-label-primary);color:var(--dsw-alias-label-primary)}.pBeByW_auxiliaryMenu button{border-radius:6px;width:100%;min-height:34px;padding:6px 8px}.pBeByW_auxiliaryMenu button:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.pBeByW_auxiliaryButton{width:34px;height:34px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:7px;flex:none;justify-content:center;align-items:center;padding:0;display:inline-flex}.pBeByW_auxiliaryButton:hover,.pBeByW_auxiliaryButton[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.pBeByW_auxiliarySpacer{flex:1}.pBeByW_auxiliaryMenu{z-index:12;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);width:220px;box-shadow:var(--dsw-shadow-lv3);border-radius:8px;padding:6px;position:absolute;top:40px;right:46px}.pBeByW_auxiliaryView{min-width:0;min-height:0;overflow:hidden}.pBeByW_frame[data-details-collapsed] .pBeByW_rightCol{border-left:none}.pBeByW_handle{cursor:col-resize;z-index:2;touch-action:none;width:8px;transition:left var(--ds-transition-duration-slow) var(--ds-ease-in-out);margin-left:-4px;position:absolute;top:0;bottom:0}.pBeByW_frame[data-dragging] .pBeByW_handle{transition:none}@media (prefers-reduced-motion:reduce){.pBeByW_handle{transition:none}}.pBeByW_handle[data-side=details]:after{content:\"\";box-sizing:border-box;background:var(--dsw-alias-button-floating-fill);border:1px solid var(--dsw-alias-border-l2-darkmode-thin);opacity:0;width:12px;height:32px;transition:opacity var(--ds-transition-duration-slow) var(--ds-ease-in-out), background var(--ds-transition-duration-slow) var(--ds-ease-in-out);border-radius:10px;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)}.pBeByW_rightCol:hover~.pBeByW_handle[data-side=details]:after,.pBeByW_handle[data-side=details]:hover:after,.pBeByW_handle[data-side=details][data-dragging=true]:after{opacity:1}.pBeByW_bottomHandle{cursor:row-resize;z-index:5;touch-action:none;height:8px;margin-top:-4px;position:absolute;left:0;right:0}.pBeByW_bottomHandle:after{content:\"\";background:0 0;height:1px;position:absolute;top:3px;left:0;right:0}.pBeByW_bottomHandle:hover:after,.pBeByW_bottomHandle[data-dragging=true]:after{background:var(--dsw-alias-border-l3)}.pBeByW_workbenchToolbar{z-index:10;align-items:center;gap:4px;display:flex;position:absolute;top:14px;right:132px}.pBeByW_toolbarButton{width:34px;height:34px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:7px;justify-content:center;align-items:center;padding:0;display:inline-flex}.pBeByW_toolbarButton:hover,.pBeByW_toolbarButton[data-active]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.pBeByW_bottomPanelIcon{transform:rotate(-90deg)}.pBeByW_sidePanelIcon{transform:scaleX(-1)}.pBeByW_panelMenu{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);width:196px;box-shadow:var(--dsw-shadow-lv3);border-radius:8px;padding:6px;position:absolute;top:40px;right:0}.pBeByW_panelMenu button{width:100%;height:36px;color:var(--dsw-alias-label-primary);cursor:pointer;text-align:left;background:0 0;border:none;border-radius:6px;align-items:center;gap:10px;padding:0 10px;font-size:13px;display:flex}.pBeByW_panelMenu button:hover{background:var(--dsw-alias-interactive-bg-hover)}@media (width<=900px){.pBeByW_workbenchToolbar{top:54px;right:12px}}.pBeByW_handle[data-side=details]:hover:after,.pBeByW_handle[data-side=details][data-dragging=true]:after{background:var(--dsw-alias-button-floating-hover);border-color:var(--dsw-alias-border-l3)}.pBeByW_overlayLayer{z-index:20;pointer-events:none;position:absolute;inset:0}.pBeByW_overlayLayer>*{pointer-events:auto}";
		const tagId = "@relay/dsh-plugin-workbench/AppFrame.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "@relay/dsh-plugin-workbench";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var AppFrame_module_css_default = {
			"auxiliary": "pBeByW_auxiliary",
			"auxiliaryButton": "pBeByW_auxiliaryButton",
			"auxiliaryMenu": "pBeByW_auxiliaryMenu",
			"auxiliarySpacer": "pBeByW_auxiliarySpacer",
			"auxiliaryTabList": "pBeByW_auxiliaryTabList",
			"auxiliaryTabs": "pBeByW_auxiliaryTabs",
			"auxiliaryView": "pBeByW_auxiliaryView",
			"bottomCol": "pBeByW_bottomCol",
			"bottomHandle": "pBeByW_bottomHandle",
			"bottomPanelIcon": "pBeByW_bottomPanelIcon",
			"centerCol": "pBeByW_centerCol",
			"centerStack": "pBeByW_centerStack",
			"frame": "pBeByW_frame",
			"handle": "pBeByW_handle",
			"overlayLayer": "pBeByW_overlayLayer",
			"panelMenu": "pBeByW_panelMenu",
			"rightCol": "pBeByW_rightCol",
			"rightSurface": "pBeByW_rightSurface",
			"sidebarCol": "pBeByW_sidebarCol",
			"sidePanelIcon": "pBeByW_sidePanelIcon",
			"toolbarButton": "pBeByW_toolbarButton",
			"workbenchToolbar": "pBeByW_workbenchToolbar"
		};
		//#endregion
		//#region src/client/layout/AppFrame.tsx
		/**
		* Three-column shell frame, registered into the built-in 'root' slot (the web
		* shell renders only 'root'). Owns the grid tracks (sidebar | center |
		* details), the drag handles (pointer capture + rAF throttle), the concession
		* chain (columns.ts), and the child-slot render decisions: the sidebar slot
		* renders HERE with live parameters from the concession solve, and the
		* session-aware occupants render in fixed column positions; strict entries
		* gate themselves on current-session availability while session-maybe
		* entries retain identity. Pure component: everything arrives
		* through the three framework shares — zero cordis or framework imports,
		* zero self-made hooks.
		*/
		/** Right column keeps both surfaces mounted and switches only visibility. */
		function RightColumn(props) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: AppFrame_module_css_default.rightCol,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: AppFrame_module_css_default.rightSurface,
					"data-active": !props.sideOpen || void 0,
					children: props.details
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: AppFrame_module_css_default.rightSurface,
					"data-active": props.sideOpen || void 0,
					children: props.auxiliary
				})]
			});
		}
		function AuxiliaryWorkspace(props) {
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const root = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (!menuOpen) return;
				const close = (event) => {
					if (event.target instanceof Node && !root.current?.contains(event.target)) setMenuOpen(false);
				};
				const escape = (event) => {
					if (event.key === "Escape") setMenuOpen(false);
				};
				document.addEventListener("mousedown", close);
				document.addEventListener("keydown", escape);
				return () => {
					document.removeEventListener("mousedown", close);
					document.removeEventListener("keydown", escape);
				};
			}, [menuOpen]);
			const activateView = (viewId) => {
				props.activateView(viewId);
				setMenuOpen(false);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				ref: root,
				className: AppFrame_module_css_default.auxiliary,
				"aria-label": "Auxiliary workspace",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
					className: AppFrame_module_css_default.auxiliaryTabs,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: AppFrame_module_css_default.auxiliaryTabList,
							role: "tablist",
							"aria-label": "Auxiliary views",
							children: props.views.map((view) => {
								const Icon = view.icon;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									role: "tab",
									"aria-selected": view.id === props.activeView,
									"data-active": view.id === props.activeView || void 0,
									onClick: () => {
										activateView(view.id);
									},
									children: [Icon && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: view.title })]
								}, view.id);
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: "Add auxiliary view",
							side: "bottom",
							delayMs: 400,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: AppFrame_module_css_default.auxiliaryButton,
								"aria-label": "Add auxiliary view",
								"aria-expanded": menuOpen,
								onClick: () => {
									setMenuOpen((open) => !open);
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPlusOutline16, {})
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: AppFrame_module_css_default.auxiliarySpacer }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
							label: "Close side panel",
							side: "bottom",
							delayMs: 400,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: AppFrame_module_css_default.auxiliaryButton,
								"aria-label": "Close side panel",
								onClick: props.closePanel,
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPanelLeftOutline16, { className: AppFrame_module_css_default.sidePanelIcon })
							})
						}),
						menuOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: AppFrame_module_css_default.auxiliaryMenu,
							role: "menu",
							"aria-label": "Auxiliary views menu",
							children: props.views.map((view) => {
								const Icon = view.icon;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									role: "menuitem",
									onClick: () => {
										activateView(view.id);
									},
									children: [Icon && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: view.title })]
								}, view.id);
							})
						})
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: AppFrame_module_css_default.auxiliaryView,
					children: props.renderView(props.activeView)
				})]
			});
		}
		/**
		* One drag handle: pointer capture, rAF-throttled dx reports against the drag-start origin.
		* `side` keys the hover-reveal CSS to the owning column.
		*/
		function DragHandle(props) {
			const [dragging, setDragging] = (0, react.useState)(false);
			const origin = (0, react.useRef)(0);
			const latest = (0, react.useRef)(0);
			const frame = (0, react.useRef)(null);
			const callbacks = (0, react.useRef)({
				onStart: props.onStart,
				onDrag: props.onDrag,
				onEnd: props.onEnd
			});
			callbacks.current = {
				onStart: props.onStart,
				onDrag: props.onDrag,
				onEnd: props.onEnd
			};
			const onPointerDown = (0, react.useCallback)((e) => {
				e.preventDefault();
				e.currentTarget.setPointerCapture(e.pointerId);
				origin.current = e.clientX;
				latest.current = e.clientX;
				callbacks.current.onStart();
				setDragging(true);
			}, []);
			const onPointerMove = (0, react.useCallback)((e) => {
				if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
				latest.current = e.clientX;
				frame.current ??= requestAnimationFrame(() => {
					frame.current = null;
					callbacks.current.onDrag(latest.current - origin.current);
				});
			}, []);
			const onPointerUp = (0, react.useCallback)((e) => {
				if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
				e.currentTarget.releasePointerCapture(e.pointerId);
				if (frame.current !== null) {
					cancelAnimationFrame(frame.current);
					frame.current = null;
				}
				callbacks.current.onDrag(latest.current - origin.current);
				setDragging(false);
				callbacks.current.onEnd();
			}, []);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: AppFrame_module_css_default.handle,
				style: { left: props.left },
				"data-side": props.side,
				"data-dragging": dragging || void 0,
				onPointerDown,
				onPointerMove,
				onPointerUp
			});
		}
		/** Horizontal splitter for the frame-owned bottom panel. */
		function BottomDragHandle(props) {
			const [dragging, setDragging] = (0, react.useState)(false);
			const origin = (0, react.useRef)(0);
			const latest = (0, react.useRef)(0);
			const frame = (0, react.useRef)(null);
			const callbacks = (0, react.useRef)({
				onStart: props.onStart,
				onDrag: props.onDrag,
				onEnd: props.onEnd
			});
			callbacks.current = {
				onStart: props.onStart,
				onDrag: props.onDrag,
				onEnd: props.onEnd
			};
			const onPointerDown = (0, react.useCallback)((event) => {
				event.preventDefault();
				event.currentTarget.setPointerCapture(event.pointerId);
				origin.current = event.clientY;
				latest.current = event.clientY;
				callbacks.current.onStart();
				setDragging(true);
			}, []);
			const onPointerMove = (0, react.useCallback)((event) => {
				if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
				latest.current = event.clientY;
				frame.current ??= requestAnimationFrame(() => {
					frame.current = null;
					callbacks.current.onDrag(latest.current - origin.current);
				});
			}, []);
			const onPointerUp = (0, react.useCallback)((event) => {
				if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
				event.currentTarget.releasePointerCapture(event.pointerId);
				if (frame.current !== null) {
					cancelAnimationFrame(frame.current);
					frame.current = null;
				}
				callbacks.current.onDrag(latest.current - origin.current);
				setDragging(false);
				callbacks.current.onEnd();
			}, []);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: AppFrame_module_css_default.bottomHandle,
				style: { top: props.top },
				"data-dragging": dragging || void 0,
				onPointerDown,
				onPointerMove,
				onPointerUp
			});
		}
		function WorkbenchToolbar(props) {
			const [menuOpen, setMenuOpen] = (0, react.useState)(false);
			const root = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				if (!menuOpen) return;
				const close = (event) => {
					if (event.target instanceof Node && !root.current?.contains(event.target)) setMenuOpen(false);
				};
				const escape = (event) => {
					if (event.key === "Escape") setMenuOpen(false);
				};
				document.addEventListener("mousedown", close);
				document.addEventListener("keydown", escape);
				return () => {
					document.removeEventListener("mousedown", close);
					document.removeEventListener("keydown", escape);
				};
			}, [menuOpen]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: root,
				className: AppFrame_module_css_default.workbenchToolbar,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
						label: "Panels",
						side: "bottom",
						delayMs: 400,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: AppFrame_module_css_default.toolbarButton,
							"aria-label": "Open panel menu",
							"aria-expanded": menuOpen,
							onClick: () => {
								setMenuOpen((open) => !open);
							},
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconListPenOutline16, {})
						})
					}),
					props.hasBottomViews && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
						label: "Toggle bottom panel",
						side: "bottom",
						delayMs: 400,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: AppFrame_module_css_default.toolbarButton,
							"data-active": props.bottomOpen || void 0,
							"aria-label": "Toggle bottom panel",
							"aria-pressed": props.bottomOpen,
							onClick: props.toggleBottom,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPanelLeftOutline16, { className: AppFrame_module_css_default.bottomPanelIcon })
						})
					}),
					props.hasSideViews && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Tooltip, {
						label: "Toggle side panel",
						side: "bottom",
						delayMs: 400,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: AppFrame_module_css_default.toolbarButton,
							"data-active": props.sideOpen || void 0,
							"aria-label": "Toggle side panel",
							"aria-pressed": props.sideOpen,
							onClick: props.toggleSide,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconPanelLeftOutline16, { className: AppFrame_module_css_default.sidePanelIcon })
						})
					}),
					menuOpen && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: AppFrame_module_css_default.panelMenu,
						role: "menu",
						"aria-label": "Workbench panels",
						children: props.views.map((view) => {
							const Icon = view.icon;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "menuitem",
								onClick: () => {
									props.openView(view);
									setMenuOpen(false);
								},
								children: [Icon && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(Icon, {}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: view.title })]
							}, `${view.region}:${view.id}`);
						})
					})
				]
			});
		}
		/** The workbench frame (navigation | conversation + bottom views | details/side views). */
		function AppFrame({ useStore, useSessions, actions, renderSlot, workbench }) {
			const panels = useStore((s) => s);
			const workbenchSnapshot = (0, react.useSyncExternalStore)(workbench.subscribe, workbench.getSnapshot, workbench.getSnapshot);
			const sideViews = (0, react.useMemo)(() => workbenchSnapshot.views.filter((view) => view.region === "side"), [workbenchSnapshot]);
			const bottomViews = (0, react.useMemo)(() => workbenchSnapshot.views.filter((view) => view.region === "bottom"), [workbenchSnapshot]);
			const detailsSession = useSessions((s) => {
				const current = s.current;
				return current !== void 0 && s.byId[current]?.blank === false ? current : void 0;
			});
			const frameRef = (0, react.useRef)(null);
			const [viewport, setViewport] = (0, react.useState)(() => window.innerWidth);
			const [viewportHeight, setViewportHeight] = (0, react.useState)(() => window.innerHeight);
			const lastSession = (0, react.useRef)(detailsSession);
			(0, react.useLayoutEffect)(() => {
				if (detailsSession === void 0) return;
				if (lastSession.current !== void 0 && lastSession.current !== detailsSession) actions.closeDetails();
				lastSession.current = detailsSession;
			}, [actions, detailsSession]);
			(0, react.useEffect)(() => {
				if (!sideViews.some((view) => view.id === panels.sideView)) actions.selectSideView(sideViews[0]?.id ?? "");
				if (!bottomViews.some((view) => view.id === panels.bottomView)) actions.selectBottomView(bottomViews[0]?.id ?? "");
				if (sideViews.length === 0 && panels.sidePanel > 0) actions.closeSidePanel();
				if (bottomViews.length === 0 && panels.bottomPanel > 0) actions.closeBottomPanel();
			}, [
				actions,
				bottomViews,
				panels.bottomPanel,
				panels.bottomView,
				panels.sidePanel,
				panels.sideView,
				sideViews
			]);
			(0, react.useEffect)(() => {
				const el = frameRef.current;
				/* v8 ignore next -- the ref is always attached by effect time: the frame div renders unconditionally. */
				if (el === null) return;
				let raf = null;
				const observer = new ResizeObserver(() => {
					raf ??= requestAnimationFrame(() => {
						raf = null;
						const rect = el.getBoundingClientRect();
						const width = rect.width;
						if (width > 0) setViewport(width);
						if (rect.height > 0) setViewportHeight(rect.height);
					});
				});
				observer.observe(el);
				return () => {
					observer.disconnect();
					if (raf !== null) cancelAnimationFrame(raf);
				};
			}, []);
			const sideOpen = panels.sidePanel > 0;
			const narrow = viewport < SIDEBAR_AUTO_COLLAPSE;
			(0, react.useEffect)(() => {
				actions.setNarrow(narrow);
			}, [actions, narrow]);
			const sidePanelNeedsSidebarRail = sideOpen && panels.sidebar > 0 && viewport < panels.sidebar + 680 + 640;
			const sidebarCollapsed = narrow ? !panels.narrowExpanded : panels.sidebar === 0 || sidePanelNeedsSidebarRail;
			const sidebarPreference = sidebarCollapsed ? 0 : panels.sidebar === 0 ? 280 : panels.sidebar;
			const bottomOpen = panels.bottomPanel > 0;
			const cols = computeColumns(viewport, sidebarPreference, sideOpen ? panels.sidePanel : detailsSession === void 0 ? 0 : panels.details, sideOpen ? {
				min: 680,
				max: SIDE_PANEL_MAX,
				preserveMinimum: true
			} : void 0);
			const bottomHeight = bottomOpen ? Math.min(panels.bottomPanel, Math.max(180, viewportHeight - 260)) : 0;
			const colsRef = (0, react.useRef)(cols);
			colsRef.current = cols;
			const sidebarBase = (0, react.useRef)(0);
			const detailsBase = (0, react.useRef)(0);
			const bottomBase = (0, react.useRef)(0);
			const [dragging, setDragging] = (0, react.useState)(false);
			const onDragEnd = (0, react.useCallback)(() => {
				setDragging(false);
			}, []);
			const onSidebarStart = (0, react.useCallback)(() => {
				sidebarBase.current = colsRef.current.sidebar;
				setDragging(true);
			}, []);
			const onDetailsStart = (0, react.useCallback)(() => {
				detailsBase.current = colsRef.current.details;
				setDragging(true);
			}, []);
			const onSidebarDrag = (0, react.useCallback)((dx) => {
				actions.setSidebar(sidebarBase.current + dx);
			}, [actions]);
			const onDetailsDrag = (0, react.useCallback)((dx) => {
				if (sideOpen) actions.setSidePanel(detailsBase.current - dx);
				else actions.setDetails(detailsBase.current - dx);
			}, [actions, sideOpen]);
			const onBottomStart = (0, react.useCallback)(() => {
				bottomBase.current = bottomHeight;
				setDragging(true);
			}, [bottomHeight]);
			const onBottomDrag = (0, react.useCallback)((dy) => {
				actions.setBottomPanel(bottomBase.current - dy);
			}, [actions]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: frameRef,
				className: AppFrame_module_css_default.frame,
				style: { gridTemplateColumns: `${cols.sidebar}px minmax(0, 1fr) ${cols.details}px` },
				"data-sidebar-collapsed": sidebarCollapsed || void 0,
				"data-details-collapsed": cols.details === 0 || void 0,
				"data-bottom-collapsed": bottomHeight === 0 || void 0,
				"data-dragging": dragging || void 0,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: AppFrame_module_css_default.sidebarCol,
						children: renderSlot("sidebar", {
							collapsed: sidebarCollapsed,
							width: cols.sidebar
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: AppFrame_module_css_default.centerStack,
						style: { gridTemplateRows: `minmax(0, 1fr) ${bottomHeight}px` },
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: AppFrame_module_css_default.centerCol,
								children: renderSlot("conversation", {})
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: AppFrame_module_css_default.bottomCol,
								children: panels.bottomView && renderSlot("workbench.bottom.view", { closePanel: actions.closeBottomPanel }, { entryKey: panels.bottomView })
							}),
							workbenchSnapshot.views.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkbenchToolbar, {
								views: workbenchSnapshot.views,
								hasBottomViews: bottomViews.length > 0,
								hasSideViews: sideViews.length > 0,
								bottomOpen,
								sideOpen,
								toggleBottom: actions.toggleBottomPanel,
								toggleSide: actions.toggleSidePanel,
								openView: (view) => {
									if (view.region === "side") actions.activateSideView(view.id);
									else actions.activateBottomView(view.id);
								}
							}),
							bottomHeight > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(BottomDragHandle, {
								top: viewportHeight - bottomHeight,
								onStart: onBottomStart,
								onDrag: onBottomDrag,
								onEnd: onDragEnd
							})
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(RightColumn, {
						sideOpen,
						details: renderSlot("details", {}),
						auxiliary: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AuxiliaryWorkspace, {
							activeView: panels.sideView,
							views: sideViews,
							activateView: actions.activateSideView,
							closePanel: actions.closeSidePanel,
							renderView: (viewId) => renderSlot("workbench.side.view", { closePanel: actions.closeSidePanel }, { entryKey: viewId })
						})
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: AppFrame_module_css_default.overlayLayer,
						"data-shell-overlay": true,
						children: renderSlot("shell.overlay", {})
					}),
					!sidebarCollapsed && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DragHandle, {
						side: "sidebar",
						left: cols.sidebar,
						onStart: onSidebarStart,
						onDrag: onSidebarDrag,
						onEnd: onDragEnd
					}),
					cols.details > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(DragHandle, {
						side: "details",
						left: viewport - cols.details,
						onStart: onDetailsStart,
						onDrag: onDetailsDrag,
						onEnd: onDragEnd
					})
				]
			});
		}
		//#endregion
		//#region src/client/layout/stores.ts
		function createLayoutStore() {
			return (0, _deepseek_ai_dsh_client_runtime_client.defineStore)({
				init: () => ({
					sidebar: 280,
					details: 0,
					sidePanel: 0,
					bottomPanel: 0,
					sideView: "",
					bottomView: "",
					narrow: false,
					narrowExpanded: false
				}),
				actions: {
					setSidebar: (d, px) => {
						d.sidebar = clampWidth(px, 264, 420);
					},
					setDetails: (d, px) => {
						d.details = clampWidth(px, 300, 520);
					},
					setSidePanel: (d, px) => {
						d.sidePanel = clampWidth(px, 680, SIDE_PANEL_MAX);
					},
					setBottomPanel: (d, px) => {
						d.bottomPanel = clampWidth(px, 180, 520);
					},
					toggleSidebar: (d) => {
						if (d.narrow) d.narrowExpanded = !d.narrowExpanded;
						else d.sidebar = d.sidebar === 0 ? 280 : 0;
					},
					setNarrow: (d, narrow) => {
						if (d.narrow === narrow) return;
						d.narrow = narrow;
						d.narrowExpanded = false;
					},
					openDetails: (d) => {
						if (d.details === 0) d.details = 360;
					},
					closeDetails: (d) => {
						d.details = 0;
					},
					toggleSidePanel: (d) => {
						d.sidePanel = d.sidePanel === 0 ? 820 : 0;
					},
					closeSidePanel: (d) => {
						d.sidePanel = 0;
					},
					selectSideView: (d, viewId) => {
						d.sideView = viewId;
					},
					activateSideView: (d, viewId) => {
						d.sideView = viewId;
						if (d.sidePanel === 0) d.sidePanel = 820;
					},
					toggleBottomPanel: (d) => {
						d.bottomPanel = d.bottomPanel === 0 ? 280 : 0;
					},
					closeBottomPanel: (d) => {
						d.bottomPanel = 0;
					},
					selectBottomView: (d, viewId) => {
						d.bottomView = viewId;
					},
					activateBottomView: (d, viewId) => {
						d.bottomView = viewId;
						if (d.bottomPanel === 0) d.bottomPanel = 280;
					}
				}
			});
		}
		//#endregion
		//#region src/client/layout/service.ts
		const EMPTY_SNAPSHOT = Object.freeze({ views: Object.freeze([]) });
		var WorkbenchController = class {
			apiVersion = 1;
			#panels;
			#views = /* @__PURE__ */ new Map();
			#listeners = /* @__PURE__ */ new Set();
			#snapshot = EMPTY_SNAPSHOT;
			attachPanels(actions) {
				this.#panels = actions;
			}
			registerView(descriptor) {
				validateDescriptor(descriptor);
				const key = viewKey(descriptor.region, descriptor.id);
				if (this.#views.has(key)) throw new Error(`workbench view ${key} is already registered`);
				const stored = Object.freeze({ ...descriptor });
				this.#views.set(key, stored);
				this.#publish();
				return () => {
					if (this.#views.get(key) !== stored) return;
					this.#views.delete(key);
					this.#publish();
				};
			}
			getSnapshot = () => this.#snapshot;
			subscribe = (listener) => {
				this.#listeners.add(listener);
				return () => {
					this.#listeners.delete(listener);
				};
			};
			openView(region, viewId) {
				if (!this.#views.has(viewKey(region, viewId))) throw new Error(`workbench view ${region}:${viewId} is not registered`);
				if (region === "side") this.#require().activateSideView(viewId);
				else this.#require().activateBottomView(viewId);
			}
			toggleRegion(region) {
				if (region === "side") this.#require().toggleSidePanel();
				else this.#require().toggleBottomPanel();
			}
			closeRegion(region) {
				if (region === "side") this.#require().closeSidePanel();
				else this.#require().closeBottomPanel();
			}
			toggleSidebar() {
				this.#require().toggleSidebar();
			}
			openDetails() {
				this.#require().openDetails();
			}
			closeDetails() {
				this.#require().closeDetails();
			}
			#require() {
				if (this.#panels === void 0) throw new Error("workbench panel actions are not mounted");
				return this.#panels;
			}
			#publish() {
				const views = [...this.#views.values()].sort((left, right) => left.region.localeCompare(right.region) || (left.order ?? 0) - (right.order ?? 0) || left.id.localeCompare(right.id));
				this.#snapshot = Object.freeze({ views: Object.freeze(views) });
				for (const listener of this.#listeners) listener();
			}
		};
		function viewKey(region, id) {
			return `${region}:${id}`;
		}
		function validateDescriptor(descriptor) {
			if (!descriptor.id || !/^[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/.test(descriptor.id)) throw new Error("workbench view id must be lowercase and stable");
			if (descriptor.region !== "side" && descriptor.region !== "bottom") throw new Error("workbench view region is invalid");
			if (!descriptor.title.trim()) throw new Error("workbench view title must be non-empty");
		}
		//#endregion
		//#region src/client/layout/theme-presenter.ts
		/** Body attribute selecting the dark base palette in the token stylesheets. */
		const DARK_ATTRIBUTE = "data-ds-dark-theme";
		/** Applies theme snapshots to the document; one instance per plugin fiber. */
		var ThemePresenter = class {
			/** Token names this presenter wrote in the last apply (its retraction set). */
			appliedTokens = [];
			/** The single metadata node this presenter inserts and removes. */
			themeColorMeta;
			/** Create the presenter-owned metadata node before the first snapshot arrives. */
			constructor() {
				this.themeColorMeta = document.createElement("meta");
				this.themeColorMeta.name = "theme-color";
			}
			/**
			* Project a snapshot onto the document: set root `color-scheme` and the body
			* palette attribute from `active.colorScheme` (never the id — `system` is
			* resolved upstream), then replace the previously applied token variables
			* with `active.tokens`. Browser theme-color metadata follows the computed
			* body background after those writes, so the rendered palette remains the
			* color authority.
			* @param snapshot - resolved theme snapshot from ctx.theme.
			*/
			apply(snapshot) {
				const scheme = snapshot.active.colorScheme;
				document.documentElement.style.colorScheme = scheme;
				const body = document.body;
				if (scheme === "dark") body.setAttribute(DARK_ATTRIBUTE, "");
				else body.removeAttribute(DARK_ATTRIBUTE);
				for (const name of this.appliedTokens) body.style.removeProperty(name);
				this.appliedTokens = [];
				for (const [name, value] of Object.entries(snapshot.active.tokens)) {
					body.style.setProperty(name, value);
					this.appliedTokens.push(name);
				}
				this.themeColorMeta.content = getComputedStyle(body).backgroundColor;
				if (!this.themeColorMeta.isConnected) document.head.append(this.themeColorMeta);
			}
			/** Retract root color-scheme, the palette attribute, token variables, and the owned metadata node. */
			dispose() {
				document.documentElement.style.removeProperty("color-scheme");
				const body = document.body;
				body.removeAttribute(DARK_ATTRIBUTE);
				for (const name of this.appliedTokens) body.style.removeProperty(name);
				this.appliedTokens = [];
				this.themeColorMeta.remove();
			}
		};
		//#endregion
		//#region src/client/layout/index.ts
		const inject = ["slots", "theme"];
		function apply(ctx) {
			const workbench = new WorkbenchController();
			ctx.effect(() => {
				const disposeLayout = ctx.reflect.provide("layout", workbench);
				const disposeWorkbench = ctx.reflect.provide("workbench", workbench);
				const disposeRegistration = ctx.slots.register({
					name: "root",
					children: {
						"sidebar": {
							kind: "single",
							scope: "root"
						},
						"conversation": {
							kind: "single",
							scope: "session-maybe"
						},
						"details": {
							kind: "single",
							scope: "session"
						},
						"workbench.side.view": {
							kind: "keyed",
							scope: "root"
						},
						"workbench.bottom.view": {
							kind: "keyed",
							scope: "root"
						},
						"shell.overlay": {
							kind: "list",
							scope: "root"
						}
					},
					store: createLayoutStore,
					inject: (actions) => {
						workbench.attachPanels(actions);
						return { workbench };
					}
				}, AppFrame);
				return () => {
					disposeRegistration();
					disposeWorkbench();
					disposeLayout();
				};
			}, "relay-workbench: services and root layout");
			ctx.effect(() => {
				const presenter = new ThemePresenter();
				presenter.apply(ctx.theme.getTheme());
				const off = ctx.on("theme/change", (snapshot) => {
					presenter.apply(snapshot);
				});
				return () => {
					off();
					presenter.dispose();
				};
			}, "relay-workbench: theme presenter");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map