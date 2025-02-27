import React from 'dom-chef';
import select from 'select-dom';
import delegate from 'delegate-it';
import elementReady from 'element-ready';
import * as pageDetect from 'github-url-detection';

import features from '.';
import * as api from '../github-helpers/api';
import GitHubURL from '../github-helpers/github-url';
import addNotice from '../github-widgets/notice-bar';
import {linkifiedURLClass} from '../github-helpers/dom-formatters';
import {buildRepoURL, isPermalink} from '../github-helpers';

async function updateURLtoDatedSha(url: GitHubURL, date: string): Promise<void> {
	const {repository} = await api.v4(`
		repository() {
			ref(qualifiedName: "${url.branch}") {
				target {
					... on Commit {
						history(first: 1, until: "${date}") {
							nodes {
								oid
							}
						}
					}
				}
			}
		}
	`);

	const [{oid}] = repository.ref.target.history.nodes;
	select('a.rgh-link-date')!.pathname = url.assign({branch: oid}).pathname;
}

function addInlineLinks(menu: HTMLElement, timestamp: string): void {
	const comment = menu.closest('.js-comment')!;

	const links = select.all<HTMLAnchorElement>(`
		[href^="${location.origin}"][href*="/blob/"]:not(.${linkifiedURLClass}),
		[href^="${location.origin}"][href*="/tree/"]:not(.${linkifiedURLClass})
	`, comment);

	for (const link of links) {
		const linkParts = link.pathname.split('/');
		// Skip permalinks
		if (/^[\da-f]{40}$/.test(linkParts[4])) {
			continue;
		}

		const searchParameters = new URLSearchParams(link.search);
		searchParameters.set('rgh-link-date', timestamp);
		link.search = String(searchParameters);
	}
}

function addDropdownLink(menu: HTMLElement, timestamp: string): void {
	const dropdown = select('.show-more-popover', menu.parentElement!)!;

	dropdown.append(
		<>
			<div className="dropdown-divider"/>
			<a
				href={buildRepoURL(`tree/HEAD@{${timestamp}}`)}
				className={'dropdown-item btn-link ' + linkifiedURLClass}
				role="menuitem"
				title="Browse repository like it appeared on this day"
			>
				View repo at this time
			</a>
		</>,
	);
}

async function showTimeMachineBar(): Promise<void | false> {
	const url = new URL(location.href); // This can't be replaced with `GitHubURL` because `getCurrentBranch` throws on 404s
	const date = url.searchParams.get('rgh-link-date')!;

	// Drop parameter from current page after using it
	url.searchParams.delete('rgh-link-date');
	history.replaceState(history.state, document.title, url.href);

	if (pageDetect.is404()) {
		const pathnameParts = url.pathname.split('/');
		pathnameParts[4] = `HEAD@{${date}}`;
		url.pathname = pathnameParts.join('/');
	} else {
		// This feature only makes sense if the URL points to a non-permalink
		if (await isPermalink()) {
			return false;
		}

		const lastCommitDate = await elementReady('.repository-content .Box.Box--condensed relative-time', {waitForChildren: false});
		if (lastCommitDate && date > lastCommitDate.getAttribute('datetime')!) {
			return false;
		}

		const parsedUrl = new GitHubURL(location.href);
		// Due to GitHub’s bug of supporting branches with slashes: #2901
		void updateURLtoDatedSha(parsedUrl, date); // Don't await it, since the link will usually work without the update

		parsedUrl.branch = `${parsedUrl.branch}@{${date}}`;
		url.pathname = parsedUrl.pathname;
	}

	const link = (
		<a className="rgh-link-date" href={url.href} data-pjax="#repo-content-pjax-container">
			view this object as it appeared at the time of the comment
		</a>
	);
	addNotice(
		<>You can also {link} (<relative-time datetime={date}/>)</>,
	);
}

function updateMenu({delegateTarget: menu}: delegate.Event<MouseEvent, HTMLElement>): void {
	if (menu.classList.contains('rgh-time-machine-links')) {
		return;
	}

	const timestamp = menu.closest('.js-comment:not(.timeline-comment-group), .js-timeline-item')!.querySelector('relative-time')!.attributes.datetime.value;

	addDropdownLink(menu, timestamp);
	addInlineLinks(menu, timestamp);
	menu.classList.add('rgh-time-machine-links');
}

function init(): void {
	// Use `click` handler instead of `toggle` because there's no easy selector just for `details`
	delegate(document, '.js-reaction-popover-container ~ details:last-child', 'click', updateMenu);
}

void features.add(__filebasename, {
	include: [
		pageDetect.hasComments,
	],
	exclude: [
		pageDetect.isGist,
	],
	deduplicate: 'has-rgh-inner',
	init,
}, {
	asLongAs: [
		() => new URLSearchParams(location.search).has('rgh-link-date'),
	],
	include: [
		pageDetect.is404,
		pageDetect.isSingleFile,
		pageDetect.isRepoTree,
	],
	awaitDomReady: false,
	init: showTimeMachineBar,
});
