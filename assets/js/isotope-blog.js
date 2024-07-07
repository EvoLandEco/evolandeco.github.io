"use strict";


/* ======= Isotope plugin ======= */
/* Ref: http://isotope.metafizzy.co/ */
// init Isotope

const isotopeContainer = document.querySelector('.isotope');
const filterItems = document.querySelectorAll('#filters .type');

imagesLoaded(isotopeContainer, function () {

    var iso = new Isotope( isotopeContainer, {
        // options
        itemSelector: '.grid-item',
        layoutMode: 'masonry',
        percentPosition: true
    });

    // filter items on click
    filterItems.forEach((filterItem) => {

        filterItem.addEventListener('click', (e) => {

            let filterValue = filterItem.getAttribute('data-filter');

            // arrange - https://isotope.metafizzy.co/methods.html
            iso.arrange({ filter: filterValue });


            //toggle active class
            for (let siblingFilterItem of filterItem.parentNode.children) {
                siblingFilterItem.classList.remove('active');
            }
            filterItem.classList.add('active');

        });

    });
})










