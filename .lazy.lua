return {
	{ import = "lazyvim.plugins.extras.lang.typescript" },
	{ import = "lazyvim.plugins.extras.formatting.prettier" },
	{
		"neovim/nvim-lspconfig",
		opts = {
			servers = {
				vtsls = {
					cmd = { "npx", "vtsls", "--stdio" },
				},
			},
		},
	},
}
