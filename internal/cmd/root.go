package cmd

import (
	"bufio"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/briandowns/spinner"
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "prj",
	Short: "Project management tool",
	Long:  `A CLI tool to manage and organize your git projects.`,
	Args:  cobra.ArbitraryArgs,
	Run: func(cmd *cobra.Command, args []string) {
		if len(args) == 1 {
			if index, err := strconv.Atoi(args[0]); err == nil {
				runCd(cmd, []string{strconv.Itoa(index)})
				return
			}
		}
		cmd.Help()
	},
}

var installCmd = &cobra.Command{
	Use:     "install",
	Aliases: []string{"i"},
	Short:   "Install all projects from .current-projects file",
	Run:     runInstall,
}

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize the projects directory and configuration",
	Run:   runInit,
}

var statusCmd = &cobra.Command{
	Use:     "status",
	Aliases: []string{"s"},
	Short:   "Show git status for all projects",
	Run:     runStatus,
}

var addCmd = &cobra.Command{
	Use:     "add [repo]",
	Aliases: []string{"a"},
	Short:   "Add a repository to projects and install it",
	Args:    cobra.ExactArgs(1),
	Run:     runAdd,
}

var cdCmd = &cobra.Command{
	Use:   "cd [index]",
	Short: "Change directory to a project by index",
	Args:  cobra.ExactArgs(1),
	Run:   runCd,
}

var listCmd = &cobra.Command{
	Use:     "list",
	Aliases: []string{"l"},
	Short:   "List all projects without git status",
	Run:     runList,
}

const (
	colorReset  = "\033[0m"
	colorRed    = "\033[31m"
	colorGreen  = "\033[32m"
	colorBlue   = "\033[34m"
	colorOrange = "\033[33m"
)

func init() {
	rootCmd.AddCommand(installCmd)
	rootCmd.AddCommand(initCmd)
	rootCmd.AddCommand(statusCmd)
	rootCmd.AddCommand(addCmd)
	rootCmd.AddCommand(cdCmd)
	rootCmd.AddCommand(listCmd)
}

// Execute runs the root command
func Execute() error {
	return rootCmd.Execute()
}

func runInit(cmd *cobra.Command, args []string) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Fatal(err)
	}

	projectsDir := filepath.Join(homeDir, "Projects")
	if err := ensureDirectory(projectsDir); err != nil {
		log.Fatal(err)
	}

	currentProjectsFile := filepath.Join(projectsDir, ".current-projects")
	if _, err := os.Stat(currentProjectsFile); os.IsNotExist(err) {
		f, err := os.Create(currentProjectsFile)
		if err != nil {
			log.Fatal("Failed to create .current-projects file:", err)
		}
		defer f.Close()

		content := `# Add your git repositories here, one per line
# Example:
# git@github.com:username/repo.git
`
		if _, err := f.WriteString(content); err != nil {
			log.Fatal("Failed to write to .current-projects file:", err)
		}
		fmt.Printf("Created .current-projects file at: %s\n", currentProjectsFile)
		fmt.Println("Add your repositories to this file, one per line")
	} else {
		fmt.Println("Project directory already initialized")
	}
}

func runInstall(cmd *cobra.Command, args []string) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Fatal(err)
	}

	projectsDir := filepath.Join(homeDir, "Projects")
	currentProjectsFile := filepath.Join(projectsDir, ".current-projects")

	if _, err := os.Stat(currentProjectsFile); os.IsNotExist(err) {
		fmt.Println("Projects directory not initialized. Please run 'prj init' first")
		os.Exit(1)
	}

	if err := ensureDirectory(projectsDir); err != nil {
		log.Fatal(err)
	}

	repos, err := readRepoList(currentProjectsFile)
	if err != nil {
		log.Fatal(err)
	}

	for _, repo := range repos {
		if err := installRepo(projectsDir, repo); err != nil {
			log.Printf("Error installing %s: %v", repo, err)
		}
	}
}

func ensureDirectory(dir string) error {
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return os.MkdirAll(dir, 0755)
	}
	return nil
}

func readRepoList(file string) ([]string, error) {
	f, err := os.Open(file)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	var repos []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" && !strings.HasPrefix(line, "#") {
			repos = append(repos, line)
		}
	}
	return repos, scanner.Err()
}

func installRepo(projectsDir, repoURL string) error {
	parts := strings.Split(repoURL, ":")
	if len(parts) != 2 {
		return fmt.Errorf("invalid git URL format: %s", repoURL)
	}

	pathParts := strings.Split(strings.TrimSuffix(parts[1], ".git"), "/")
	if len(pathParts) != 2 {
		return fmt.Errorf("invalid repository path: %s", repoURL)
	}

	username := strings.ToLower(pathParts[0])
	repoName := strings.ToLower(pathParts[1])

	userDir := filepath.Join(projectsDir, username)
	if err := ensureDirectory(userDir); err != nil {
		return err
	}

	repoPath := filepath.Join(userDir, repoName)
	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		fmt.Printf("Cloning %s into %s\n", repoURL, repoPath)
		return executeGit("clone", repoURL, repoPath)
	}

	fmt.Printf("Repository already exists at %s\n", repoPath)
	return nil
}

func executeGit(args ...string) error {
	cmd := exec.Command("git", args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	return cmd.Run()
}

func runStatus(cmd *cobra.Command, args []string) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Fatal(err)
	}

	projectsDir := filepath.Join(homeDir, "Projects")
	currentProjectsFile := filepath.Join(projectsDir, ".current-projects")

	if _, err := os.Stat(currentProjectsFile); os.IsNotExist(err) {
		fmt.Println("Projects directory not initialized. Please run 'prj init' first")
		os.Exit(1)
	}

	repos, err := readRepoList(currentProjectsFile)
	if err != nil {
		log.Fatal(err)
	}

	s := spinner.New(spinner.CharSets[9], 100*time.Millisecond)
	s.Suffix = " Checking projects..."
	s.Start()

	// Create ordered slice of results
	results := make([]string, len(repos))
	var wg sync.WaitGroup

	maxRepoLength := 0
	maxBranchLength := 0
	for _, repo := range repos {
		parts := strings.Split(repo, ":")
		if len(parts) != 2 {
			continue
		}
		pathParts := strings.Split(strings.TrimSuffix(parts[1], ".git"), "/")
		if len(pathParts) != 2 {
			continue
		}
		repoDisplay := fmt.Sprintf("%s/%s",
			strings.ToLower(pathParts[0]),
			strings.ToLower(pathParts[1]))
		if len(repoDisplay) > maxRepoLength {
			maxRepoLength = len(repoDisplay)
		}

		// Get branch name length
		repoPath := filepath.Join(projectsDir, strings.ToLower(pathParts[0]), strings.ToLower(pathParts[1]))
		if branch, err := executeGitWithOutput(repoPath, "rev-parse", "--abbrev-ref", "HEAD"); err == nil {
			branch = strings.TrimSpace(branch)
			if len(branch) > maxBranchLength {
				maxBranchLength = len(branch)
			}
		}
	}

	for i, repo := range repos {
		wg.Add(1)
		go func(repo string, index int) {
			defer wg.Done()
			if status, err := getRepoStatus(projectsDir, repo, maxRepoLength, maxBranchLength); err == nil {
				results[index] = status
			} else {
				log.Printf("Error checking status for %s: %v", repo, err)
			}
		}(repo, i)
	}

	wg.Wait()
	s.Stop()

	count := 1
	for _, status := range results {
		if status != "" {
			fmt.Printf("%3d %s\n", count, status)
			count++
		}
	}
}

func getRepoStatus(projectsDir, repo string, padRepoLength, padBranchLength int) (string, error) {
	parts := strings.Split(repo, ":")
	if len(parts) != 2 {
		return "", fmt.Errorf("invalid repo URL: %s", repo)
	}

	pathParts := strings.Split(strings.TrimSuffix(parts[1], ".git"), "/")
	if len(pathParts) != 2 {
		return "", fmt.Errorf("invalid repo path: %s", repo)
	}

	username := strings.ToLower(pathParts[0])
	repoName := strings.ToLower(pathParts[1])
	repoPath := filepath.Join(projectsDir, username, repoName)

	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		return fmt.Sprintf("%s/%s: Not installed", username, repoName), nil
	}

	branch, err := executeGitWithOutput(repoPath, "rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		return "", fmt.Errorf("error getting branch: %v", err)
	}
	branch = strings.TrimSpace(branch)

	if err := executeGitQuiet(repoPath, "fetch"); err != nil {
		return "", fmt.Errorf("error fetching: %v", err)
	}

	repoDisplay := fmt.Sprintf("%s/%s", username, repoName)

	status := fmt.Sprintf("%-*s git:(%s%s%s)%s",
		padRepoLength, repoDisplay,
		colorBlue, branch, colorReset,
		strings.Repeat(" ", padBranchLength-len(branch)))

	isClean := true
	hasUpstream, _ := executeGitWithOutput(repoPath, "rev-parse", "--abbrev-ref", "@{u}")
	if hasUpstream != "" {
		behindCount, err := executeGitWithOutput(repoPath, "rev-list", "--count", "HEAD..@{u}")
		if err == nil && strings.TrimSpace(behindCount) != "0" {
			status += fmt.Sprintf(" %s[%s↓]%s", colorBlue, strings.TrimSpace(behindCount), colorReset)
			isClean = false
		}

		aheadCount, err := executeGitWithOutput(repoPath, "rev-list", "--count", "@{u}..HEAD")
		if err == nil && strings.TrimSpace(aheadCount) != "0" {
			status += fmt.Sprintf(" %s[%s↑]%s", colorOrange, strings.TrimSpace(aheadCount), colorReset)
			isClean = false
		}
	} else {
		mainBranch := "main"
		if _, err := executeGitWithOutput(repoPath, "rev-parse", "--verify", "main"); err != nil {
			mainBranch = "master"
		}

		commitCount, err := executeGitWithOutput(repoPath, "rev-list", "--count", fmt.Sprintf("%s..HEAD", mainBranch))
		if err == nil && strings.TrimSpace(commitCount) != "0" {
			status += fmt.Sprintf(" %s[%s↑]%s", colorOrange, strings.TrimSpace(commitCount), colorReset)
			isClean = false
		}
	}

	changedFiles, err := executeGitWithOutput(repoPath, "status", "--porcelain")
	if err == nil && changedFiles != "" {
		fileCount := len(strings.Split(strings.TrimSpace(changedFiles), "\n"))
		if fileCount > 0 {
			status += fmt.Sprintf(" %s[%d changes]%s", colorRed, fileCount, colorReset)
			isClean = false
		}
	}

	if isClean {
		status += fmt.Sprintf(" %s[✓ clean]%s", colorGreen, colorReset)
	}

	return status, nil
}

func executeGitWithOutput(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	out, err := cmd.Output()
	return string(out), err
}

func executeGitQuiet(dir string, args ...string) error {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	cmd.Stdout = nil
	cmd.Stderr = nil
	return cmd.Run()
}

func runAdd(cmd *cobra.Command, args []string) {
	repoURL := args[0]
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Fatal(err)
	}

	projectsDir := filepath.Join(homeDir, "Projects")
	currentProjectsFile := filepath.Join(projectsDir, ".current-projects")

	if _, err := os.Stat(currentProjectsFile); os.IsNotExist(err) {
		fmt.Println("Projects directory not initialized. Please run 'prj init' first")
		os.Exit(1)
	}

	repos, err := readRepoList(currentProjectsFile)
	if err != nil {
		log.Fatal(err)
	}

	for _, repo := range repos {
		if repo == repoURL {
			fmt.Println("Repository already exists in projects file")
			return
		}
	}

	f, err := os.OpenFile(currentProjectsFile, os.O_APPEND|os.O_WRONLY, 0644)
	if err != nil {
		log.Fatal(err)
	}
	defer f.Close()

	if _, err := f.WriteString(repoURL + "\n"); err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Added %s to projects file\n", repoURL)

	if err := installRepo(projectsDir, repoURL); err != nil {
		log.Printf("Error installing %s: %v", repoURL, err)
	}
}

func runCd(cmd *cobra.Command, args []string) {
	index, err := strconv.Atoi(args[0])
	if err != nil {
		log.Fatal("Invalid index number")
	}

	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Fatal(err)
	}

	projectsDir := filepath.Join(homeDir, "Projects")
	currentProjectsFile := filepath.Join(projectsDir, ".current-projects")

	repos, err := readRepoList(currentProjectsFile)
	if err != nil {
		log.Fatal(err)
	}

	index--
	if index < 0 || index >= len(repos) {
		log.Fatal("ID out of range")
	}

	repo := repos[index]
	parts := strings.Split(repo, ":")
	if len(parts) != 2 {
		log.Fatal("Invalid repo URL format")
	}

	pathParts := strings.Split(strings.TrimSuffix(parts[1], ".git"), "/")
	if len(pathParts) != 2 {
		log.Fatal("Invalid repository path")
	}

	username := strings.ToLower(pathParts[0])
	repoName := strings.ToLower(pathParts[1])
	repoPath := filepath.Join(projectsDir, username, repoName)

	if _, err := os.Stat(repoPath); os.IsNotExist(err) {
		log.Fatal("Repository not installed")
	}

	fmt.Println(repoPath)
}

func runList(cmd *cobra.Command, args []string) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Fatal(err)
	}

	projectsDir := filepath.Join(homeDir, "Projects")
	currentProjectsFile := filepath.Join(projectsDir, ".current-projects")

	if _, err := os.Stat(currentProjectsFile); os.IsNotExist(err) {
		fmt.Println("Projects directory not initialized. Please run 'prj init' first")
		os.Exit(1)
	}

	repos, err := readRepoList(currentProjectsFile)
	if err != nil {
		log.Fatal(err)
	}

	var displayNames []string
	for _, repo := range repos {
		parts := strings.Split(repo, ":")
		if len(parts) != 2 {
			continue
		}
		pathParts := strings.Split(strings.TrimSuffix(parts[1], ".git"), "/")
		if len(pathParts) != 2 {
			continue
		}
		displayName := fmt.Sprintf("%s/%s",
			strings.ToLower(pathParts[0]),
			strings.ToLower(pathParts[1]))
		displayNames = append(displayNames, displayName)
	}

	for i, name := range displayNames {
		fmt.Printf("%3d %s\n", i+1, name)
	}
}
